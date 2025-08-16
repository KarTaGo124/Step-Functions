import AWS from "aws-sdk";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const COMPRAS_TABLE = process.env.COMPRAS_TABLE;

export async function handler(event) {
  console.log('GenerateInvoice input:', JSON.stringify(event, null, 2));
  
  try {
    const { compra_id, tenant_id, total, productos, payment_info } = event;
    
    console.log(`🧾 Generando factura para compra ${compra_id}`);
    
    const invoiceNumber = `INV-${tenant_id.toUpperCase()}-${Date.now()}`;
    const invoiceDate = new Date().toISOString();
    
    const taxRate = 0.18;
    const subtotal = total / (1 + taxRate);
    const taxAmount = total - subtotal;
    
    const invoice = {
      invoice_number: invoiceNumber,
      compra_id: compra_id,
      tenant_id: tenant_id,
      issue_date: invoiceDate,
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      
      subtotal: Math.round(subtotal * 100) / 100,
      tax_rate: taxRate,
      tax_amount: Math.round(taxAmount * 100) / 100,
      total: total,
      currency: 'USD',
      
      line_items: productos.map((producto, index) => ({
        line_number: index + 1,
        codigo: producto.codigo,
        description: producto.nombre,
        quantity: producto.cantidad,
        unit_price: producto.precio_unitario,
        line_total: producto.subtotal
      })),
      
      payment_info: {
        transaction_id: payment_info?.transaction_id,
        payment_method: payment_info?.payment_method,
        payment_status: 'paid'
      },
      
      generated_at: invoiceDate,
      generated_by: 'system',
      status: 'issued'
    };
    
    await dynamodb.update({
      TableName: COMPRAS_TABLE,
      Key: {
        tenant_id: tenant_id,
        compra_id: compra_id
      },
      UpdateExpression: 'SET estado = :estado, invoice = :invoice, updated_at = :updated_at',
      ExpressionAttributeValues: {
        ':estado': 'facturado',
        ':invoice': invoice,
        ':updated_at': new Date().toISOString()
      }
    }).promise();
    
    console.log(`✅ Factura ${invoiceNumber} generada para compra ${compra_id}`);
    
    return {
      ...event,
      invoice_status: 'generated',
      invoice: invoice,
      invoice_timestamp: invoiceDate
    };
    
  } catch (error) {
    console.error('❌ Error generating invoice:', error);
    
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
            ':estado': 'error_facturacion',
            ':error': error.message,
            ':updated_at': new Date().toISOString()
          }
        }).promise();
      } catch (updateError) {
        console.error('Error updating invoice error status:', updateError);
      }
    }
    
    throw error;
  }
}
