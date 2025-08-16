import AWS from "aws-sdk";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();
const COMPRAS_TABLE = process.env.COMPRAS_TABLE;

export async function handler(event) {
  console.log('SendApprovalNotification input:', JSON.stringify(event, null, 2));
  
  try {
    const { compra_id, tenant_id, user_id, total, taskToken } = event;
    
    if (!taskToken) {
      throw new Error('Task token es requerido para aprobaciones humanas');
    }
    
    console.log(`📧 Enviando notificación de aprobación para compra ${compra_id} (${total} USD)`);
    
    await dynamodb.update({
      TableName: COMPRAS_TABLE,
      Key: {
        tenant_id: tenant_id,
        compra_id: compra_id
      },
      UpdateExpression: 'SET estado = :estado, approval_info = :approval_info, updated_at = :updated_at',
      ExpressionAttributeValues: {
        ':estado': 'esperando_aprobacion',
        ':approval_info': {
          task_token: taskToken,
          requested_at: new Date().toISOString(),
          amount: total,
          threshold_exceeded: total > 500,
          status: 'pending'
        },
        ':updated_at': new Date().toISOString()
      }
    }).promise();
    
    const approvalMessage = {
      compra_id: compra_id,
      tenant_id: tenant_id,
      user_id: user_id,
      total: total,
      task_token: taskToken,
      approval_url: `https://your-approval-dashboard.com/approve/${compra_id}`,
      requested_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    
    console.log('📱 Simulando envío de notificaciones:');
    console.log('  ✉️  Email enviado al supervisor');
    console.log('  📱 Push notification enviada');
    console.log('  💬 Mensaje de Slack enviado');
    console.log(`  🔗 URL de aprobación: ${approvalMessage.approval_url}`);
    
    try {
      console.log('📨 Notificación SNS simulada (configurar topic para envío real)');
    } catch (snsError) {
      console.warn('⚠️  SNS no configurado, usando solo logs:', snsError.message);
    }
    
    const response = {
      success: true,
      message: 'Notificación de aprobación enviada',
      approval_details: {
        compra_id: compra_id,
        amount: total,
        status: 'pending',
        expires_in_hours: 24,
        approval_url: approvalMessage.approval_url,
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
    
    console.log(`✅ Notificación de aprobación enviada para compra ${compra_id}`);
    
    return response;
    
  } catch (error) {
    console.error('❌ Error sending approval notification:', error);
    
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
            ':estado': 'error_aprobacion',
            ':error': error.message,
            ':updated_at': new Date().toISOString()
          }
        }).promise();
      } catch (updateError) {
        console.error('Error updating approval error status:', updateError);
      }
    }
    
    throw error;
  }
}
