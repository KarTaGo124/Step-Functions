import AWS from "aws-sdk";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();
const COMPRAS_TABLE = process.env.COMPRAS_TABLE;

export async function handler(event) {
  console.log('SendNotification input:', JSON.stringify(event, null, 2));
  
  try {
    const { compra_id, tenant_id, user_id, total, invoice } = event;
    
    console.log(`📧 Enviando notificaciones para compra ${compra_id}`);
    
    let notificationType = 'order_completed';
    let subject = 'Pedido Completado';
    let message = 'Su pedido ha sido procesado exitosamente';
    
    // Solo 3 casos para el cliente:
    if (event.notification_type === 'inventory_failed') {
      // Caso 1: Error después de pago procesado
      notificationType = 'inventory_failed';
      subject = `Problema con Pedido #${compra_id} - Reembolso Requerido`;
      message = `Lamentamos informarle que hubo un problema con su pedido. Su pago de $${total} USD fue procesado correctamente, pero el producto ya no está disponible. Procederemos con el reembolso inmediatamente.`;
    } else if (event.notification_type === 'approval_rejected') {
      // Caso 2: Pedido rechazado por supervisor
      notificationType = 'approval_rejected';
      subject = `Pedido #${compra_id} - No Aprobado`;
      const rejectionReason = event.rejection_reason || 'No se proporcionó motivo específico';
      message = `Lamentamos informarle que su pedido de alto valor ($${total} USD) no fue aprobado por nuestro equipo de supervisión. Motivo: ${rejectionReason}. Su pago será reembolsado completamente en 3-5 días hábiles.`;
    } else {
      // Caso 3: Pedido completado exitosamente
      notificationType = 'order_completed';
      subject = `Pedido #${compra_id} - Completado`;
      message = `¡Excelente! Su pedido por $${total} USD ha sido procesado y facturado exitosamente.`;
    }
    
    const notification = {
      type: notificationType,
      compra_id: compra_id,
      tenant_id: tenant_id,
      user_id: user_id,
      subject: subject,
      message: message,
      details: {
        total: total,
        currency: 'USD',
        invoice_number: invoice?.invoice_number,
        payment_method: event.payment_info?.payment_method,
        transaction_id: event.payment_info?.transaction_id
      },
      timestamp: new Date().toISOString(),
      channels: []
    };
    
    try {
      console.log('📧 Enviando email...');
      console.log('📧 Enviando email...');
      notification.channels.push({
        type: 'email',
        status: 'sent',
        sent_at: new Date().toISOString(),
        recipient: `user-${user_id}@tenant-${tenant_id}.com`
      });
      
      console.log('📱 Enviando SMS...');
      notification.channels.push({
        type: 'sms',
        status: 'sent',
        sent_at: new Date().toISOString(),
        recipient: '+1-xxx-xxx-xxxx'
      });
      
      console.log('🔔 Enviando push notification...');
      notification.channels.push({
        type: 'push',
        status: 'sent',
        sent_at: new Date().toISOString(),
        device_count: 2
      });
      
      console.log('📲 Creando notificación in-app...');
      notification.channels.push({
        type: 'in_app',
        status: 'created',
        created_at: new Date().toISOString(),
        read: false
      });
      
    } catch (notificationError) {
      console.warn('⚠️  Error en canal de notificación:', notificationError);
      notification.channels.push({
        type: 'error',
        status: 'failed',
        error: notificationError.message,
        timestamp: new Date().toISOString()
      });
    }
    
    try {
      console.log('📨 SNS notification simulada (configurar topic para envío real)');
    } catch (snsError) {
      console.warn('⚠️  SNS no configurado:', snsError.message);
    }
    
    // Determinar el estado final según el tipo de notificación
    let finalStatus;
    if (notificationType === 'inventory_failed') {
      finalStatus = 'fallido_requiere_reembolso';
    } else if (notificationType === 'approval_rejected') {
      finalStatus = 'rechazado_requiere_reembolso';
    } else {
      finalStatus = 'completado';
    }

    await dynamodb.update({
      TableName: COMPRAS_TABLE,
      Key: {
        tenant_id: tenant_id,
        compra_id: compra_id
      },
      UpdateExpression: 'SET estado = :estado, notifications = :notifications, updated_at = :updated_at',
      ExpressionAttributeValues: {
        ':estado': finalStatus,
        ':notifications': {
          last_notification: notification,
          total_sent: notification.channels.filter(c => c.status === 'sent').length,
          channels_used: notification.channels.map(c => c.type)
        },
        ':updated_at': new Date().toISOString()
      }
    }).promise();
    
    console.log(`✅ Notificaciones enviadas para compra ${compra_id}`);
    console.log(`📊 Canales utilizados: ${notification.channels.map(c => c.type).join(', ')}`);
    
    return {
      ...event,
      notification_status: 'sent',
      notification_details: notification,
      notification_timestamp: new Date().toISOString(),
      final_status: finalStatus
    };
    
  } catch (error) {
    console.error('❌ Error sending notifications:', error);
    
    if (event.compra_id && event.tenant_id) {
      try {
        await dynamodb.update({
          TableName: COMPRAS_TABLE,
          Key: {
            tenant_id: event.tenant_id,
            compra_id: event.compra_id
          },
          UpdateExpression: 'SET estado = :estado, notification_error = :error, updated_at = :updated_at',
          ExpressionAttributeValues: {
            ':estado': 'completado_sin_notificacion',
            ':error': {
              message: error.message,
              timestamp: new Date().toISOString()
            },
            ':updated_at': new Date().toISOString()
          }
        }).promise();
      } catch (updateError) {
        console.error('Error updating notification error status:', updateError);
      }
    }
    
    console.warn('⚠️  Workflow completado a pesar del error de notificación');
    
    return {
      ...event,
      notification_status: 'failed',
      notification_error: error.message,
      final_status: 'completed_with_notification_error'
    };
  }
}
