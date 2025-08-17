import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.PRODUCTOS_TABLE;
const JWT_SECRET = process.env.JWT_SECRET;

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
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
      email: decoded.email
    };
  } catch (error) {
    throw new Error('Token inválido');
  }
};

export async function crearProducto(event) {
  try {
    const userInfo = validateToken(event);
    const producto = JSON.parse(event.body);
    
    if (!producto.nombre || !producto.precio) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Nombre y precio son requeridos' }),
      };
    }

    const codigo = producto.codigo || uuidv4();
    const item = {
      tenant_id: userInfo.tenant_id,
      codigo: codigo,
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      precio: parseFloat(producto.precio),
      categoria: producto.categoria || '',
      stock: parseInt(producto.stock) || 0,
      created_at: new Date().toISOString(),
      created_by: userInfo.user_id,
    };

    await dynamodb.put({ 
      TableName: TABLE_NAME, 
      Item: item,
      ConditionExpression: 'attribute_not_exists(codigo)'
    }).promise();

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({ 
        mensaje: 'Producto creado exitosamente', 
        producto: item 
      }),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: error.message.includes('Token') ? 401 : 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

export async function listarProductos(event) {
  try {
    const userInfo = validateToken(event);
    const queryParams = event?.queryStringParameters || {};
    const limit = Math.min(Number(queryParams.limit) || 20, 100);
    const lastKey = queryParams.lastKey ? JSON.parse(decodeURIComponent(queryParams.lastKey)) : undefined;

    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'tenant_id = :tenant_id',
      ExpressionAttributeValues: {
        ':tenant_id': userInfo.tenant_id,
      },
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };

    const result = await dynamodb.query(params).promise();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        productos: result.Items,
        lastKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : null,
        count: result.Count,
      }),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: error.message.includes('Token') ? 401 : 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

export async function buscarProducto(event) {
  try {
    const userInfo = validateToken(event);
    const { codigo } = event.pathParameters;

    const params = {
      TableName: TABLE_NAME,
      Key: {
        tenant_id: userInfo.tenant_id,
        codigo: codigo,
      },
    };

    const result = await dynamodb.get(params).promise();

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Producto no encontrado' }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ producto: result.Item }),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: error.message.includes('Token') ? 401 : 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

export async function modificarProducto(event) {
  try {
    const userInfo = validateToken(event);
    const { codigo } = event.pathParameters;
    const updates = JSON.parse(event.body);

    const allowedFields = ['nombre', 'descripcion', 'precio', 'categoria', 'stock'];
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = updates[key];
      }
    });

    if (updateExpressions.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'No hay campos válidos para actualizar' }),
      };
    }

    updateExpressions.push('#updated_at = :updated_at', '#updated_by = :updated_by');
    expressionAttributeNames['#updated_at'] = 'updated_at';
    expressionAttributeNames['#updated_by'] = 'updated_by';
    expressionAttributeValues[':updated_at'] = new Date().toISOString();
    expressionAttributeValues[':updated_by'] = userInfo.user_id;

    const params = {
      TableName: TABLE_NAME,
      Key: {
        tenant_id: userInfo.tenant_id,
        codigo: codigo,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(codigo)',
      ReturnValues: 'ALL_NEW',
    };

    const result = await dynamodb.update(params).promise();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        mensaje: 'Producto actualizado exitosamente',
        producto: result.Attributes 
      }),
    };

  } catch (error) {
    console.error('Error:', error);
    if (error.code === 'ConditionalCheckFailedException') {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Producto no encontrado' }),
      };
    }
    return {
      statusCode: error.message.includes('Token') ? 401 : 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

export async function eliminarProducto(event) {
  try {
    const userInfo = validateToken(event);
    const { codigo } = event.pathParameters;

    const params = {
      TableName: TABLE_NAME,
      Key: {
        tenant_id: userInfo.tenant_id,
        codigo: codigo,
      },
      ConditionExpression: 'attribute_exists(codigo)',
      ReturnValues: 'ALL_OLD',
    };

    const result = await dynamodb.delete(params).promise();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        mensaje: 'Producto eliminado exitosamente',
        producto: result.Attributes 
      }),
    };

  } catch (error) {
    console.error('Error:', error);
    if (error.code === 'ConditionalCheckFailedException') {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Producto no encontrado' }),
      };
    }
    return {
      statusCode: error.message.includes('Token') ? 401 : 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

export async function listarProductosStockBajo(event) {
  try {
    const userInfo = validateToken(event);
    const queryParams = event?.queryStringParameters || {};
    const limit = Math.min(Number(queryParams.limit) || 50, 100);

    const params = {
      TableName: TABLE_NAME,
      FilterExpression: 'tenant_id = :tenant_id AND attribute_exists(stock_alert) AND attribute_exists(stock_alert.#status)',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':tenant_id': userInfo.tenant_id,
      },
      Limit: limit,
    };

    if (queryParams.lastKey) {
      params.ExclusiveStartKey = JSON.parse(decodeURIComponent(queryParams.lastKey));
    }

    const result = await dynamodb.scan(params).promise();

    const response = {
      productos: result.Items || [],
      lastKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : null,
      count: result.Items?.length || 0,
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: error.message.includes('Token') ? 401 : 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

export async function buscarProductos(event) {
  try {
    const userInfo = validateToken(event);
    const queryParams = event?.queryStringParameters || {};
    const searchQuery = queryParams.q || '';
    const limit = Math.min(Number(queryParams.limit) || 20, 100);
    const lastKey = queryParams.lastKey ? JSON.parse(decodeURIComponent(queryParams.lastKey)) : undefined;

    if (!searchQuery.trim()) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Parámetro de búsqueda "q" es requerido' }),
      };
    }

    const searchTerm = searchQuery.toLowerCase().trim();

    const params = {
      TableName: TABLE_NAME,
      FilterExpression: 'tenant_id = :tenant_id AND (contains(#nombre, :searchTerm) OR contains(#descripcion, :searchTerm) OR contains(#codigo, :searchTerm))',
      ExpressionAttributeNames: {
        '#nombre': 'nombre',
        '#descripcion': 'descripcion',
        '#codigo': 'codigo'
      },
      ExpressionAttributeValues: {
        ':tenant_id': userInfo.tenant_id,
        ':searchTerm': searchTerm,
      },
      Limit: limit,
    };

    if (lastKey) {
      params.ExclusiveStartKey = lastKey;
    }

    const result = await dynamodb.scan(params).promise();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        productos: result.Items,
        lastKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : null,
        count: result.Count,
        searchQuery: searchQuery,
      }),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: error.message.includes('Token') ? 401 : 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
