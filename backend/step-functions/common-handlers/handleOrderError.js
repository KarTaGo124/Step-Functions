import AWS from "aws-sdk";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const COMPRAS_TABLE = process.env.COMPRAS_TABLE;

export async function handler(event) {
  console.log('HandleOrderError input:', JSON.stringify(event, null, 2));
  
  try {
    const eventDetail = event.detail || event;
    const { compra_id, tenant_id } = eventDetail;
    
    if (!compra_id || !tenant_id) {
      console.error('Missing required fields: compra_id, tenant_id');
      throw new Error('Missing required fields for error handling');
    }
    
    const errorInfo = event.Error || event.error || 'Unknown error occurred';
    const errorCause = event.Cause || event.cause || 'No specific cause provided';
    
    console.log(`❌ Handling error for order ${compra_id}: ${errorInfo}`);
    
    await dynamodb.update({
      TableName: COMPRAS_TABLE,
      Key: {
        tenant_id: tenant_id,
        compra_id: compra_id
      },
      UpdateExpression: 'SET estado = :estado, error_message = :error, error_details = :details, updated_at = :updated_at',
      ExpressionAttributeValues: {
        ':estado': 'error',
        ':error': errorInfo,
        ':details': errorCause,
        ':updated_at': new Date().toISOString()
      }
    }).promise();
    
    console.log(`✅ Order ${compra_id} status updated to 'error'`);
    
    return {
      compra_id,
      tenant_id,
      status: 'error',
      error_message: errorInfo,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Error handling order error:', error);
    throw error;
  }
}
