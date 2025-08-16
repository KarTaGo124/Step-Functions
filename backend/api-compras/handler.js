import AWS from "aws-sdk";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const eventbridge = new AWS.EventBridge();

const COMPRAS_TABLE = process.env.COMPRAS_TABLE;
const PRODUCTOS_TABLE = process.env.PRODUCTOS_TABLE;
const JWT_SECRET = process.env.JWT_SECRET;

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const validateToken = (event) => {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Token no proporcionado');
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return {
      user_id: decoded.user_id,
      tenant_id: decoded.tenant_id,
      email: decoded.email,
      role: decoded.role || 'user'
    };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expirado');
    } else {
      throw new Error('Token inválido');
    }
  }
};

export async function registrarCompra(event) {
  try {
    const userInfo = validateToken(event);
    const body = JSON.parse(event.body);
    
    const productos = body.productos || [];
    if (!productos.length) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Lista de productos es requerida' }),
      };
    }
    
    for (const producto of productos) {
      if (!producto.codigo || !producto.cantidad) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Cada producto debe tener código y cantidad' }),
        };
      }
      if (producto.cantidad <= 0) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'La cantidad debe ser mayor a 0' }),
        };
      }
    }
    
    const productosValidados = [];
    let totalCompra = 0;
    
    for (const item of productos) {
      try {
        const response = await dynamodb.get({
          TableName: PRODUCTOS_TABLE,
          Key: {
            tenant_id: userInfo.tenant_id,
            codigo: item.codigo
          }
        }).promise();
        
        if (!response.Item) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: `Producto ${item.codigo} no encontrado` }),
          };
        }
        
        const producto = response.Item;
        const cantidadSolicitada = item.cantidad;
        const stockDisponible = producto.stock || 0;
        
        if (stockDisponible < cantidadSolicitada) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
              error: `Stock insuficiente para ${producto.nombre}. Disponible: ${stockDisponible}, Solicitado: ${cantidadSolicitada}`
            }),
          };
        }
        
        const subtotal = parseFloat(producto.precio) * cantidadSolicitada;
        
        productosValidados.push({
          codigo: item.codigo,
          nombre: producto.nombre,
          precio_unitario: producto.precio,
          cantidad: cantidadSolicitada,
          subtotal: subtotal
        });
        
        totalCompra += subtotal;
        
      } catch (error) {
        console.error(`Error validating product ${item.codigo}:`, error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: `Error validando producto ${item.codigo}` }),
        };
      }
    }
    
    const compraId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const compra = {
      compra_id: compraId,
      tenant_id: userInfo.tenant_id,
      user_id: userInfo.user_id,
      productos: productosValidados,
      total: totalCompra,
      estado: 'pendiente',
      created_at: timestamp,
      updated_at: timestamp,
      step_function_execution: null
    };
    
    await dynamodb.put({
      TableName: COMPRAS_TABLE,
      Item: compra
    }).promise();
    
    try {
      await eventbridge.putEvents({
        Entries: [
          {
            Source: 'ecommerce.compras',
            DetailType: 'Nueva Compra Creada',
            Detail: JSON.stringify({
              compra_id: compraId,
              user_id: userInfo.user_id,
              tenant_id: userInfo.tenant_id,
              total: totalCompra,
              productos: productosValidados
            })
          }
        ]
      }).promise();
      
      console.log(`Evento "Nueva Compra Creada" enviado a EventBridge para compra ${compraId} (Total: $${totalCompra})`);
    } catch (error) {
      console.error('Error sending event to EventBridge:', error);
    }
    
    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        mensaje: 'Compra registrada exitosamente',
        compra: {
          compra_id: compraId,
          total: totalCompra,
          productos: productosValidados,
          estado: 'pendiente',
          created_at: timestamp
        }
      }),
    };
    
  } catch (error) {
    console.error('Error registering purchase:', error);
    if (error.message.includes('Token')) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: error.message }),
      };
    }
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Error interno del servidor' }),
    };
  }
}

export async function listarCompras(event) {
  try {
    const userInfo = validateToken(event);
    
    const queryParams = event.queryStringParameters || {};
    const limit = Math.min(parseInt(queryParams.limit) || 20, 100);
    let lastKey = null;
    
    if (queryParams.lastKey) {
      try {
        lastKey = JSON.parse(decodeURIComponent(queryParams.lastKey));
      } catch (error) {
        // Ignorar lastKey inválido
      }
    }
    
    const params = {
      TableName: COMPRAS_TABLE,
      IndexName: 'user-index',
      KeyConditionExpression: 'tenant_id = :tenant_id AND user_id = :user_id',
      ExpressionAttributeValues: {
        ':tenant_id': userInfo.tenant_id,
        ':user_id': userInfo.user_id
      },
      Limit: limit,
      ScanIndexForward: false
    };
    
    if (lastKey) {
      params.ExclusiveStartKey = lastKey;
    }
    
    const response = await dynamodb.query(params).promise();
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        compras: response.Items,
        lastKey: response.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(response.LastEvaluatedKey)) : null,
        count: response.Count
      }),
    };
    
  } catch (error) {
    console.error('Error listing purchases:', error);
    if (error.message.includes('Token')) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: error.message }),
      };
    }
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Error interno del servidor' }),
    };
  }
}

export async function obtenerCompra(event) {
  try {
    const userInfo = validateToken(event);
    const compraId = event.pathParameters.compra_id;
    
    const response = await dynamodb.get({
      TableName: COMPRAS_TABLE,
      Key: {
        tenant_id: userInfo.tenant_id,
        compra_id: compraId
      }
    }).promise();
    
    if (!response.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Compra no encontrada' }),
      };
    }
    
    const compra = response.Item;
    
    if (compra.user_id !== userInfo.user_id && userInfo.role !== 'admin') {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'No autorizado para ver esta compra' }),
      };
    }
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ compra: compra }),
    };
    
  } catch (error) {
    console.error('Error getting purchase:', error);
    if (error.message.includes('Token')) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: error.message }),
      };
    }
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Error interno del servidor' }),
    };
  }
}

export async function listarComprasPendientes(event) {
  try {
    const userInfo = validateToken(event);
    
    // Solo admins pueden ver compras pendientes de aprobación
    if (userInfo.role !== 'admin') {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'No autorizado. Solo administradores pueden ver compras pendientes.' }),
      };
    }
    
    const queryParams = event?.queryStringParameters || {};
    const limit = Math.min(Number(queryParams.limit) || 50, 100);

    // Escanear compras con estado 'esperando_aprobacion'
    const params = {
      TableName: COMPRAS_TABLE,
      FilterExpression: 'tenant_id = :tenant_id AND estado = :estado',
      ExpressionAttributeValues: {
        ':tenant_id': userInfo.tenant_id,
        ':estado': 'esperando_aprobacion'
      },
      Limit: limit,
    };

    if (queryParams.lastKey) {
      params.ExclusiveStartKey = JSON.parse(decodeURIComponent(queryParams.lastKey));
    }

    const result = await dynamodb.scan(params).promise();

    const response = {
      compras: result.Items || [],
      lastKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : null,
      count: result.Items?.length || 0,
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('Error listing pending purchases:', error);
    if (error.message.includes('Token')) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: error.message }),
      };
    }
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Error interno del servidor' }),
    };
  }
}
