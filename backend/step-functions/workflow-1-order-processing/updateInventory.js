import AWS from "aws-sdk";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const eventbridge = new AWS.EventBridge();
const PRODUCTOS_TABLE = process.env.PRODUCTOS_TABLE;
const COMPRAS_TABLE = process.env.COMPRAS_TABLE;

export async function handler(event) {
  console.log('UpdateInventory input:', JSON.stringify(event, null, 2));
  
  try {
    const { compra_id, tenant_id, productos } = event;
    
    console.log(`📦 Actualizando inventario para compra ${compra_id}`);
    
    const inventoryUpdates = [];
    const lowStockAlerts = [];
    
    for (const item of productos) {
      const { codigo, cantidad } = item;
      
      console.log(`🔄 Actualizando stock para ${codigo}, reduciendo ${cantidad} unidades`);
      
      try {
        const updateResult = await dynamodb.update({
          TableName: PRODUCTOS_TABLE,
          Key: {
            tenant_id: tenant_id,
            codigo: codigo
          },
          UpdateExpression: 'ADD stock :decrease SET updated_at = :updated_at',
          ConditionExpression: 'attribute_exists(codigo) AND stock >= :cantidad',
          ExpressionAttributeValues: {
            ':decrease': -cantidad,
            ':cantidad': cantidad,
            ':updated_at': new Date().toISOString()
          },
          ReturnValues: 'ALL_NEW'
        }).promise();
        
        const newStock = updateResult.Attributes.stock;
        
        inventoryUpdates.push({
          codigo: codigo,
          previous_stock: newStock + cantidad,
          new_stock: newStock,
          quantity_sold: cantidad,
          status: 'updated'
        });
        
        console.log(`✅ Stock actualizado para ${codigo}: ${newStock + cantidad} → ${newStock}`);
        
        if (newStock < 10) {
          console.log(`⚠️  Stock bajo detectado para ${codigo}: ${newStock} unidades`);
          
          lowStockAlerts.push({
            codigo: codigo,
            nombre: updateResult.Attributes.nombre,
            stock_actual: newStock,
            categoria: updateResult.Attributes.categoria,
            precio: updateResult.Attributes.precio
          });
          
          await eventbridge.putEvents({
            Entries: [
              {
                Source: 'ecommerce.inventario',
                DetailType: 'Stock Bajo Detectado',
                Detail: JSON.stringify({
                  tenant_id: tenant_id,
                  codigo: codigo,
                  nombre: updateResult.Attributes.nombre,
                  stock: newStock,
                  threshold: 10,
                  compra_id: compra_id
                })
              }
            ]
          }).promise();
          
          console.log(`📡 Evento de stock bajo enviado para ${codigo}`);
        }
        
      } catch (updateError) {
        console.error(`❌ Error actualizando stock para ${codigo}:`, updateError);
        
        let errorMessage = `Error actualizando stock para ${codigo}`;
        let errorType = 'INVENTORY_UPDATE_ERROR';
        
        if (updateError.code === 'ConditionalCheckFailedException') {
          errorMessage = `Stock insuficiente para ${codigo}. Otro cliente compró el producto mientras procesábamos este pedido.`;
          errorType = 'INSUFFICIENT_STOCK_AT_UPDATE';
          
          console.error(`🚨 RACE CONDITION: Stock insuficiente en ${codigo} al momento de actualizar`);
        }
        
        inventoryUpdates.push({
          codigo: codigo,
          status: 'error',
          error: errorMessage,
          error_type: errorType,
          timestamp: new Date().toISOString()
        });
        
        const customError = new Error(errorMessage);
        customError.errorType = errorType;
        throw customError;
      }
    }
    
    await dynamodb.update({
      TableName: COMPRAS_TABLE,
      Key: {
        tenant_id: tenant_id,
        compra_id: compra_id
      },
      UpdateExpression: 'SET estado = :estado, inventory_update = :inventory_update, updated_at = :updated_at',
      ExpressionAttributeValues: {
        ':estado': 'inventario_actualizado',
        ':inventory_update': {
          timestamp: new Date().toISOString(),
          updates: inventoryUpdates,
          low_stock_alerts: lowStockAlerts
        },
        ':updated_at': new Date().toISOString()
      }
    }).promise();
    
    console.log(`✅ Inventario actualizado para compra ${compra_id}`);
    
    if (lowStockAlerts.length > 0) {
      console.log(`⚠️  ${lowStockAlerts.length} productos con stock bajo detectados`);
    }
    
    return {
      ...event,
      inventory_status: 'updated',
      inventory_updates: inventoryUpdates,
      low_stock_alerts: lowStockAlerts,
      inventory_timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Error updating inventory:', error);
    
    if (event.compra_id && event.tenant_id) {
      try {
        await dynamodb.update({
          TableName: COMPRAS_TABLE,
          Key: {
            tenant_id: event.tenant_id,
            compra_id: event.compra_id
          },
          UpdateExpression: 'SET estado = :estado, error_message = :error, updated_at = :updated_at',
          ExpressionAttributeValues: {
            ':estado': 'error_inventario',
            ':error': error.message,
            ':updated_at': new Date().toISOString()
          }
        }).promise();
      } catch (updateError) {
        console.error('Error updating inventory error status:', updateError);
      }
    }
    
    throw error;
  }
}
