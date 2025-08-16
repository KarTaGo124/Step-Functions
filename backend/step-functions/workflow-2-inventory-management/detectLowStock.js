import AWS from "aws-sdk";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const eventbridge = new AWS.EventBridge();
const PRODUCTOS_TABLE = process.env.PRODUCTOS_TABLE;

export async function handler(event) {
  console.log('DetectLowStock input:', JSON.stringify(event, null, 2));
  
  try {
    const eventDetail = event.detail || event;
    const { tenant_id, codigo, stock } = eventDetail;
    const threshold = eventDetail.threshold || 10;
    
    console.log(`🔍 Verificando stock para producto ${codigo}: ${stock} unidades (umbral: ${threshold})`);
    
    if (stock >= threshold) {
      console.log(`✅ Stock suficiente para ${codigo}: ${stock} >= ${threshold}`);
      return {
        tenant_id,
        codigo,
        stock,
        threshold,
        stock_status: 'sufficient',
        requires_restock: false,
        timestamp: new Date().toISOString()
      };
    }
    
    console.log(`⚠️ Stock bajo detectado para ${codigo}: ${stock} < ${threshold}`);
    
    const productData = await dynamodb.get({
      TableName: PRODUCTOS_TABLE,
      Key: { tenant_id, codigo }
    }).promise();
    
    if (!productData.Item) {
      throw new Error(`Producto ${codigo} no encontrado`);
    }
    
    const producto = productData.Item;
    
    const lowStockAlert = {
      tenant_id: tenant_id,
      codigo: codigo,
      nombre: producto.nombre,
      categoria: producto.categoria,
      current_stock: stock,
      threshold: threshold,
      severity: stock === 0 ? 'critical' : stock <= 3 ? 'high' : 'medium',
      precio: producto.precio,
      detected_at: new Date().toISOString()
    };
    
    return {
      tenant_id,
      codigo,
      stock,
      threshold,
      stock_status: 'low',
      requires_restock: true,
      low_stock_alert: lowStockAlert,
      severity: lowStockAlert.severity,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Error detecting low stock:', error);
    throw error;
  }
}
