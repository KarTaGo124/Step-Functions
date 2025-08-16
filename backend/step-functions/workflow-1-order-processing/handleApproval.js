import AWS from "aws-sdk";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const stepfunctions = new AWS.StepFunctions();
const COMPRAS_TABLE = process.env.COMPRAS_TABLE;

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

export async function handler(event) {
  console.log('HandleApproval input:', JSON.stringify(event, null, 2));
  
  try {
    const executionArn = event.pathParameters?.execution_arn;
    const body = JSON.parse(event.body || '{}');
    const { decision, reason, approver, task_token } = body;
    
    if (!executionArn && !task_token) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'execution_arn o task_token es requerido' }),
      };
    }
    
    if (!decision || !['approve', 'reject'].includes(decision)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'decision debe ser "approve" o "reject"' }),
      };
    }
    
    console.log(`📋 Procesando decisión: ${decision} por ${approver || 'supervisor'}`);
    
    let compra_id, tenant_id;
    
    if (task_token) {
      const scanParams = {
        TableName: COMPRAS_TABLE,
        FilterExpression: 'approval_info.task_token = :task_token',
        ExpressionAttributeValues: {
          ':task_token': task_token
        }
      };
      
      const scanResult = await dynamodb.scan(scanParams).promise();
      if (scanResult.Items && scanResult.Items.length > 0) {
        const compra = scanResult.Items[0];
        compra_id = compra.compra_id;
        tenant_id = compra.tenant_id;
      }
    }
    
    if (!compra_id) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Compra no encontrada o ya procesada' }),
      };
    }
    
    const newStatus = decision === 'approve' ? 'aprobado' : 'rechazado';
    const approvalResult = {
      decision: decision,
      approver: approver || 'supervisor',
      reason: reason || '',
      timestamp: new Date().toISOString(),
      execution_arn: executionArn
    };
    
    await dynamodb.update({
      TableName: COMPRAS_TABLE,
      Key: {
        tenant_id: tenant_id,
        compra_id: compra_id
      },
      UpdateExpression: 'SET estado = :estado, approval_result = :approval_result, updated_at = :updated_at',
      ExpressionAttributeValues: {
        ':estado': newStatus,
        ':approval_result': approvalResult,
        ':updated_at': new Date().toISOString()
      }
    }).promise();
    
    const finalTaskToken = task_token || await getTaskTokenFromExecution(executionArn);
    
    const compraData = await dynamodb.get({
      TableName: COMPRAS_TABLE,
      Key: {
        tenant_id: tenant_id,
        compra_id: compra_id
      }
    }).promise();
    
    if (decision === 'approve') {
      console.log('✅ Aprobando compra y continuando workflow...');
      
      const originalWorkflowData = {
        compra_id: compra_id,
        tenant_id: tenant_id,
        user_id: compraData.Item?.user_id,
        total: compraData.Item?.total,
        productos: compraData.Item?.productos,
        approved: true,
        approver: approver,
        approval_timestamp: new Date().toISOString(),
        reason: reason
      };
      
      await stepfunctions.sendTaskSuccess({
        taskToken: finalTaskToken,
        output: JSON.stringify(originalWorkflowData)
      }).promise();
      
    } else {
      console.log('❌ Rechazando compra y terminando workflow...');
      
      await stepfunctions.sendTaskFailure({
        taskToken: finalTaskToken,
        error: 'CompraRechazada',
        cause: reason || 'Compra rechazada por supervisor'
      }).promise();
    }
    
    console.log(`✅ Decisión ${decision} procesada para compra ${compra_id}`);
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: `Compra ${decision === 'approve' ? 'aprobada' : 'rechazada'} exitosamente`,
        compra_id: compra_id,
        decision: decision,
        approver: approver,
        timestamp: new Date().toISOString()
      }),
    };
    
  } catch (error) {
    console.error('❌ Error handling approval:', error);
    
    let statusCode = 500;
    let errorMessage = 'Error interno del servidor';
    
    if (error.code === 'InvalidParameterValueException') {
      statusCode = 400;
      errorMessage = 'Token de aprobación inválido o expirado';
    } else if (error.code === 'TaskDoesNotExist') {
      statusCode = 404;
      errorMessage = 'Tarea de aprobación no encontrada o ya procesada';
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
