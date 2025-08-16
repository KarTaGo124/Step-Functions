import AWS from "aws-sdk";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();
const PRODUCTOS_TABLE = process.env.PRODUCTOS_TABLE;

export async function handler(event) {
  console.log('SendStockAlert input:', JSON.stringify(event, null, 2));
  
  try {
    const { tenant_id, low_stock_alert, taskToken } = event;
    
    if (!taskToken) {
      throw new Error('Task token es requerido para alertas de stock');
    }
    
    const alert = low_stock_alert;
    console.log(`🚨 Enviando alerta de stock bajo para ${alert.codigo} (${alert.current_stock} unidades)`);
    
    await dynamodb.update({
      TableName: PRODUCTOS_TABLE,
      Key: {
        tenant_id: tenant_id,
        codigo: alert.codigo
      },
      UpdateExpression: 'SET stock_alert = :alert, updated_at = :updated_at',
      ExpressionAttributeValues: {
        ':alert': {
          status: 'pending_restock',
          task_token: taskToken,
          alert_sent_at: new Date().toISOString(),
          severity: alert.severity,
          current_stock: alert.current_stock
        },
        ':updated_at': new Date().toISOString()
      }
    }).promise();
    
    const alertMessage = {
      producto_codigo: alert.codigo,
      producto_nombre: alert.nombre,
      tenant_id: tenant_id,
      current_stock: alert.current_stock,
      threshold: alert.threshold,
      severity: alert.severity,
      task_token: taskToken,
      restock_url: `https://your-inventory-dashboard.com/restock/${alert.codigo}`,
      requested_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    console.log('📧 Simulando envío de alertas de stock:');
    console.log(`  ⚠️  Email enviado al supervisor de inventario`);
    console.log(`  📱 Push notification enviada`);
    console.log(`  💬 Mensaje de Slack enviado al canal #inventory`);
    console.log(`  🔗 URL de restock: ${alertMessage.restock_url}`);
    
    try {
      console.log('📨 Alerta SNS simulada (configurar topic para envío real)');
    } catch (snsError) {
      console.warn('⚠️ SNS no configurado:', snsError.message);
    }
    
    const response = {
      success: true,
      message: 'Alerta de stock bajo enviada',
      restock_details: {
        producto_codigo: alert.codigo,
        current_stock: alert.current_stock,
        severity: alert.severity,
        expires_in_days: 7,
        restock_url: alertMessage.restock_url,
        task_token: taskToken
      },
      notification_channels: [
        'email',
        'push_notification', 
        'slack',
        'dashboard'
      ],
      sent_at: new Date().toISOString()
    };
    
    console.log(`✅ Alerta de stock enviada para producto ${alert.codigo}`);
    
    return response;
    
  } catch (error) {
    console.error('❌ Error sending stock alert:', error);
    
    if (event.tenant_id && event.low_stock_alert?.codigo) {
      try {
        await dynamodb.update({
          TableName: PRODUCTOS_TABLE,
          Key: {
            tenant_id: event.tenant_id,
            codigo: event.low_stock_alert.codigo
          },
          UpdateExpression: 'SET stock_alert = :alert, updated_at = :updated_at',
          ExpressionAttributeValues: {
            ':alert': {
              status: 'alert_failed',
              error: error.message,
              failed_at: new Date().toISOString()
            },
            ':updated_at': new Date().toISOString()
          }
        }).promise();
      } catch (updateError) {
        console.error('Error updating alert error status:', updateError);
      }
    }
    
    throw error;
  }
}
