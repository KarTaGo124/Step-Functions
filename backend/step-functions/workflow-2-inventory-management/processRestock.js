import AWS from "aws-sdk";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const PRODUCTOS_TABLE = process.env.PRODUCTOS_TABLE;

export async function handler(event) {
  console.log('ProcessRestock input:', JSON.stringify(event, null, 2));
  
  try {
    const { tenant_id, producto_codigo, restock_quantity, supervisor } = event;
    
    console.log(`📦 Procesando restock de ${restock_quantity} unidades para producto ${producto_codigo}`);
    
    const productData = await dynamodb.get({
      TableName: PRODUCTOS_TABLE,
      Key: { tenant_id, codigo: producto_codigo }
    }).promise();
    
    if (!productData.Item) {
      throw new Error(`Producto ${producto_codigo} no encontrado`);
    }
    
    const currentStock = productData.Item.stock || 0;
    const newStock = currentStock + parseInt(restock_quantity);
    
    await dynamodb.update({
      TableName: PRODUCTOS_TABLE,
      Key: {
        tenant_id: tenant_id,
        codigo: producto_codigo
      },
      UpdateExpression: 'SET stock = :new_stock, stock_alert = :alert_cleared, restock_history = list_append(if_not_exists(restock_history, :empty_list), :restock_record), updated_at = :updated_at',
      ExpressionAttributeValues: {
        ':new_stock': newStock,
        ':alert_cleared': {
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: supervisor
        },
        ':empty_list': [],
        ':restock_record': [{
          quantity: parseInt(restock_quantity),
          previous_stock: currentStock,
          new_stock: newStock,
          supervisor: supervisor,
          processed_at: new Date().toISOString()
        }],
        ':updated_at': new Date().toISOString()
      }
    }).promise();
    
    console.log(`✅ Restock completado para ${producto_codigo}: ${currentStock} → ${newStock} unidades`);
    
    return {
      ...event,
      restock_status: 'completed',
      previous_stock: currentStock,
      new_stock: newStock,
      quantity_added: parseInt(restock_quantity),
      restock_timestamp: new Date().toISOString(),
      processed_by: supervisor
    };
    
  } catch (error) {
    console.error('❌ Error processing restock:', error);
    
    if (event.tenant_id && event.producto_codigo) {
      try {
        await dynamodb.update({
          TableName: PRODUCTOS_TABLE,
          Key: {
            tenant_id: event.tenant_id,
            codigo: event.producto_codigo
          },
          UpdateExpression: 'SET stock_alert.#status = :status, stock_alert.error_message = :error, updated_at = :updated_at',
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':status': 'restock_failed',
            ':error': error.message,
            ':updated_at': new Date().toISOString()
          }
        }).promise();
      } catch (updateError) {
        console.error('Error updating restock error status:', updateError);
      }
    }
    
    throw error;
  }
}
