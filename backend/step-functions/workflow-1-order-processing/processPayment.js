import AWS from "aws-sdk";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const COMPRAS_TABLE = process.env.COMPRAS_TABLE;

const simulatePaymentProcessing = async (total, compra_id) => {
  const processingTime = Math.random() * 1000 + 500;
  await new Promise(resolve => setTimeout(resolve, processingTime));
  
  const paymentMethods = ['credit_card', 'debit_card', 'bank_transfer', 'digital_wallet'];
  const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
  
  const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    transaction_id: transactionId,
    payment_method: paymentMethod,
    amount: total,
    currency: 'USD',
    status: 'completed',
    processing_time_ms: Math.round(processingTime),
    gateway_response: {
      code: '200',
      message: 'Payment processed successfully',
      reference: `REF_${compra_id}_${Date.now()}`
    }
  };
};

export async function handler(event) {
  console.log('ProcessPayment input:', JSON.stringify(event, null, 2));
  
  try {
    const { compra_id, tenant_id, total } = event;
    
    if (!total || total <= 0) {
      throw new Error('Monto de pago inválido');
    }
    
    console.log(`💳 Procesando pago de $${total} para compra ${compra_id}`);
    
    await dynamodb.update({
      TableName: COMPRAS_TABLE,
      Key: {
        tenant_id: tenant_id,
        compra_id: compra_id
      },
      UpdateExpression: 'SET estado = :estado, updated_at = :updated_at',
      ExpressionAttributeValues: {
        ':estado': 'procesando_pago',
        ':updated_at': new Date().toISOString()
      }
    }).promise();
    
    console.log('🔄 Conectando con gateway de pagos...');
    const paymentResult = await simulatePaymentProcessing(total, compra_id);
    
    console.log('✅ Pago procesado exitosamente:', paymentResult);
    
    await dynamodb.update({
      TableName: COMPRAS_TABLE,
      Key: {
        tenant_id: tenant_id,
        compra_id: compra_id
      },
      UpdateExpression: 'SET estado = :estado, payment_info = :payment_info, updated_at = :updated_at',
      ExpressionAttributeValues: {
        ':estado': 'pago_completado',
        ':payment_info': {
          ...paymentResult,
          processed_at: new Date().toISOString()
        },
        ':updated_at': new Date().toISOString()
      }
    }).promise();
    
    console.log(`✅ Pago completado para compra ${compra_id}. Transaction ID: ${paymentResult.transaction_id}`);
    
    return {
      ...event,
      payment_status: 'completed',
      payment_info: paymentResult,
      payment_timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Error processing payment:', error);
    
    if (event.compra_id && event.tenant_id) {
      try {
        await dynamodb.update({
          TableName: COMPRAS_TABLE,
          Key: {
            tenant_id: event.tenant_id,
            compra_id: event.compra_id
          },
          UpdateExpression: 'SET estado = :estado, payment_error = :error, updated_at = :updated_at',
          ExpressionAttributeValues: {
            ':estado': 'error_pago',
            ':error': {
              message: error.message,
              timestamp: new Date().toISOString(),
              retry_count: (event.payment_retry_count || 0) + 1
            },
            ':updated_at': new Date().toISOString()
          }
        }).promise();
      } catch (updateError) {
        console.error('Error updating payment error status:', updateError);
      }
    }
    
    if (error.message.includes('timeout')) {
      const retryCount = event.payment_retry_count || 0;
      if (retryCount < 3) {
        console.log(`🔄 Reintentando pago (intento ${retryCount + 1}/3)`);
        return {
          ...event,
          payment_retry_count: retryCount + 1,
          last_error: error.message
        };
      }
    }
    
    throw error;
  }
}
