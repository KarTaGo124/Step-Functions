import AWS from "aws-sdk";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const stepfunctions = new AWS.StepFunctions();
const PRODUCTOS_TABLE = process.env.PRODUCTOS_TABLE;

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

export async function handler(event) {
  console.log('HandleRestockDecision input:', JSON.stringify(event, null, 2));
  
  try {
    const executionArn = event.pathParameters?.execution_arn;
    const body = JSON.parse(event.body || '{}');
    const { decision, restock_quantity, supervisor, task_token } = body;
    
    if (!executionArn && !task_token) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'execution_arn o task_token es requerido' }),
      };
    }
    
    if (!decision || !['approve_restock', 'delay_restock', 'discontinue'].includes(decision)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'decision debe ser "approve_restock", "delay_restock" o "discontinue"' }),
      };
    }
    
    console.log(`📋 Procesando decisión de restock: ${decision} por ${supervisor || 'supervisor'}`);
    
    let producto_codigo, tenant_id;
    
    if (task_token) {
      const scanParams = {
        TableName: PRODUCTOS_TABLE,
        FilterExpression: 'stock_alert.task_token = :task_token',
        ExpressionAttributeValues: {
          ':task_token': task_token
        }
      };
      
      const scanResult = await dynamodb.scan(scanParams).promise();
      if (scanResult.Items && scanResult.Items.length > 0) {
        const producto = scanResult.Items[0];
        producto_codigo = producto.codigo;
        tenant_id = producto.tenant_id;
      }
    }
    
    if (!producto_codigo) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Producto no encontrado o alerta ya procesada' }),
      };
    }
    
    const restockResult = {
      decision: decision,
      supervisor: supervisor || 'supervisor',
      restock_quantity: restock_quantity || 0,
      timestamp: new Date().toISOString(),
      execution_arn: executionArn
    };
    
    let newStatus = 'pending_restock';
    if (decision === 'approve_restock') {
      newStatus = 'restock_approved';
    } else if (decision === 'delay_restock') {
      newStatus = 'restock_delayed';
    } else if (decision === 'discontinue') {
      newStatus = 'product_discontinued';
    }
    
    await dynamodb.update({
      TableName: PRODUCTOS_TABLE,
      Key: {
        tenant_id: tenant_id,
        codigo: producto_codigo
      },
      UpdateExpression: 'SET stock_alert.#status = :status, restock_decision = :decision, updated_at = :updated_at',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': newStatus,
        ':decision': restockResult,
        ':updated_at': new Date().toISOString()
      }
    }).promise();
    
    const finalTaskToken = task_token || await getTaskTokenFromExecution(executionArn);
    
    if (decision === 'approve_restock') {
      console.log(`✅ Aprobando restock de ${restock_quantity} unidades...`);
      
      await stepfunctions.sendTaskSuccess({
        taskToken: finalTaskToken,
        output: JSON.stringify({
          approved: true,
          decision: decision,
          restock_quantity: restock_quantity,
          supervisor: supervisor,
          approval_timestamp: new Date().toISOString()
        })
      }).promise();
      
    } else {
      console.log(`❌ ${decision === 'delay_restock' ? 'Posponiendo' : 'Discontinuando'} restock...`);
      
      await stepfunctions.sendTaskFailure({
        taskToken: finalTaskToken,
        error: decision === 'delay_restock' ? 'RestockDelayed' : 'ProductDiscontinued',
        cause: `Decisión: ${decision} - Supervisor: ${supervisor}`
      }).promise();
    }
    
    console.log(`✅ Decisión ${decision} procesada para producto ${producto_codigo}`);
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: `Restock ${decision === 'approve_restock' ? 'aprobado' : decision === 'delay_restock' ? 'pospuesto' : 'discontinuado'} exitosamente`,
        producto_codigo: producto_codigo,
        decision: decision,
        restock_quantity: restock_quantity,
        supervisor: supervisor,
        timestamp: new Date().toISOString()
      }),
    };
    
  } catch (error) {
    console.error('❌ Error handling restock decision:', error);
    
    let statusCode = 500;
    let errorMessage = 'Error interno del servidor';
    
    if (error.code === 'InvalidParameterValueException') {
      statusCode = 400;
      errorMessage = 'Token de restock inválido o expirado';
    } else if (error.code === 'TaskDoesNotExist') {
      statusCode = 404;
      errorMessage = 'Tarea de restock no encontrada o ya procesada';
    }
    
    return {
      statusCode: statusCode,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: errorMessage,
        details: error.message 
      }),
    };
  }
}

async function getTaskTokenFromExecution(executionArn) {
  try {
    const execution = await stepfunctions.describeExecution({
      executionArn: executionArn
    }).promise();
    
    const input = JSON.parse(execution.input);
    return input.taskToken;
    
  } catch (error) {
    console.error('Error getting task token from execution:', error);
    throw new Error('No se pudo obtener task token de la ejecución');
  }
}
