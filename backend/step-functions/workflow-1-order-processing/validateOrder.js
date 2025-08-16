import AWS from "aws-sdk";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const COMPRAS_TABLE = process.env.COMPRAS_TABLE;

export async function handler(event) {
  console.log('ValidateOrder input:', JSON.stringify(event, null, 2));
  
  try {
    // Extraer datos del detail del evento de EventBridge
    const eventDetail = event.detail || event;
    const { compra_id, tenant_id, user_id, total, productos } = eventDetail;
    
    if (!compra_id || !tenant_id || !user_id) {
      throw new Error('Faltan campos requeridos: compra_id, tenant_id, user_id');
    }
    
    if (!productos || productos.length === 0) {
      throw new Error('La compra debe tener al menos un producto');
    }
    
    if (!total || total <= 0) {
      throw new Error('El total debe ser mayor a 0');
    }
    
    const compraResponse = await dynamodb.get({
      TableName: COMPRAS_TABLE,
      Key: {
        tenant_id: tenant_id,
        compra_id: compra_id
      }
    }).promise();
    
    if (!compraResponse.Item) {
      throw new Error(`Compra ${compra_id} no encontrada`);
    }
    
    const compra = compraResponse.Item;
    
    if (compra.estado !== 'pendiente') {
      throw new Error(`Compra ${compra_id} no está en estado pendiente. Estado actual: ${compra.estado}`);
    }
    
    await dynamodb.update({
      TableName: COMPRAS_TABLE,
      Key: {
        tenant_id: tenant_id,
        compra_id: compra_id
      },
      UpdateExpression: 'SET estado = :estado, updated_at = :updated_at',
      ExpressionAttributeValues: {
        ':estado': 'validando',
        ':updated_at': new Date().toISOString()
      }
    }).promise();
    
    console.log(`✅ Compra ${compra_id} validada exitosamente`);
    
    return {
      compra_id,
      tenant_id,
      user_id,
      total,
      productos,
      validation_status: 'success',
      validation_timestamp: new Date().toISOString(),
      compra_details: compra
    };
    
  } catch (error) {
    console.error('❌ Error validating order:', error);
    
    const eventDetail = event.detail || event;
    const { compra_id, tenant_id } = eventDetail;
    
    if (compra_id && tenant_id) {
      try {
        await dynamodb.update({
          TableName: COMPRAS_TABLE,
          Key: {
            tenant_id: tenant_id,
            compra_id: compra_id
          },
          UpdateExpression: 'SET estado = :estado, error_message = :error, updated_at = :updated_at',
          ExpressionAttributeValues: {
            ':estado': 'error',
            ':error': error.message,
            ':updated_at': new Date().toISOString()
          }
        }).promise();
      } catch (updateError) {
        console.error('Error updating order status to error:', updateError);
      }
    }
    
    throw error;
  }
}
