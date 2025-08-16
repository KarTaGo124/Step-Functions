import AWS from "aws-sdk";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const PRODUCTOS_TABLE = process.env.PRODUCTOS_TABLE;
const COMPRAS_TABLE = process.env.COMPRAS_TABLE;

export async function handler(event) {
  console.log('CheckInventory input:', JSON.stringify(event, null, 2));
  
  try {
    const { compra_id, tenant_id, productos } = event;
    
    if (!productos || productos.length === 0) {
      throw new Error('No hay productos para verificar');
    }
    
    const inventoryResults = [];
    let allProductsAvailable = true;
    
    for (const item of productos) {
      const { codigo, cantidad } = item;
      
      console.log(`🔍 Verificando stock para producto ${codigo}, cantidad solicitada: ${cantidad}`);
      
      const productResponse = await dynamodb.get({
        TableName: PRODUCTOS_TABLE,
        Key: {
          tenant_id: tenant_id,
          codigo: codigo
        }
      }).promise();
      
      if (!productResponse.Item) {
        console.log(`❌ Producto ${codigo} no encontrado`);
        allProductsAvailable = false;
        inventoryResults.push({
          codigo: codigo,
          status: 'not_found',
          requested: cantidad,
          available: 0,
          message: `Producto ${codigo} no encontrado`
        });
        continue;
      }
      
      const producto = productResponse.Item;
      const stockActual = producto.stock || 0;
      
      if (stockActual < cantidad) {
        console.log(`❌ Stock insuficiente para ${codigo}. Disponible: ${stockActual}, Solicitado: ${cantidad}`);
        allProductsAvailable = false;
        inventoryResults.push({
          codigo: codigo,
          status: 'insufficient_stock',
          requested: cantidad,
          available: stockActual,
          message: `Stock insuficiente. Disponible: ${stockActual}, Solicitado: ${cantidad}`
        });
      } else {
        console.log(`✅ Stock suficiente para ${codigo}. Disponible: ${stockActual}, Solicitado: ${cantidad}`);
        inventoryResults.push({
          codigo: codigo,
          status: 'available',
          requested: cantidad,
          available: stockActual,
          message: 'Stock suficiente'
        });
      }
    }
    
    const newStatus = allProductsAvailable ? 'stock_verificado' : 'stock_insuficiente';
    
    await dynamodb.update({
      TableName: COMPRAS_TABLE,
      Key: {
        tenant_id: tenant_id,
        compra_id: compra_id
      },
      UpdateExpression: 'SET estado = :estado, inventory_check = :inventory_check, updated_at = :updated_at',
      ExpressionAttributeValues: {
        ':estado': newStatus,
        ':inventory_check': {
          timestamp: new Date().toISOString(),
          all_available: allProductsAvailable,
          results: inventoryResults
        },
        ':updated_at': new Date().toISOString()
      }
    }).promise();
    
    if (!allProductsAvailable) {
      const unavailableProducts = inventoryResults.filter(r => r.status !== 'available');
      throw new Error(`Stock insuficiente para productos: ${unavailableProducts.map(p => p.codigo).join(', ')}`);
    }
    
    console.log(`✅ Inventario verificado exitosamente para compra ${compra_id}`);
    
    return {
      ...event,
      inventory_status: 'sufficient',
      inventory_check_timestamp: new Date().toISOString(),
      inventory_results: inventoryResults
    };
    
  } catch (error) {
    console.error('❌ Error checking inventory:', error);
    
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
        console.error('Error updating order status:', updateError);
      }
    }
    
    throw error;
  }
}
