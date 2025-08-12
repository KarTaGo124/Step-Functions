import AWS from "aws-sdk";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.USUARIOS_TABLE;
const JWT_SECRET = process.env.JWT_SECRET;

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

export async function crearUsuario(event) {
  try {
    const body = JSON.parse(event.body);
    
    const requiredFields = ['email', 'password', 'nombre', 'tenant_id'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: `Campo ${field} es requerido` }),
        };
      }
    }
    
    const email = body.email.toLowerCase().trim();
    const password = body.password;
    const nombre = body.nombre;
    const tenant_id = body.tenant_id;
    
    if (!email.includes('@') || !email.includes('.')) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Formato de email inválido' }),
      };
    }
    
    try {
      const existingUser = await dynamodb.get({
        TableName: TABLE_NAME,
        Key: {
          tenant_id: tenant_id,
          email: email
        }
      }).promise();
      
      if (existingUser.Item) {
        return {
          statusCode: 409,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Usuario ya existe' }),
        };
      }
    } catch (error) {
      console.error('Error checking user existence:', error);
    }
    
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const userId = uuidv4();
    const usuario = {
      user_id: userId,
      tenant_id: tenant_id,
      email: email,
      nombre: nombre,
      password_hash: hashedPassword,
      created_at: new Date().toISOString(),
      is_active: true,
      role: body.role || 'user'
    };
    
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: usuario
    }).promise();
    
    const { password_hash, ...usuarioResponse } = usuario;
    
    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        mensaje: 'Usuario creado exitosamente',
        usuario: usuarioResponse
      }),
    };
    
  } catch (error) {
    console.error('Error creating user:', error);
    if (error instanceof SyntaxError) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'JSON inválido' }),
      };
    }
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Error interno del servidor' }),
    };
  }
}

export async function loginUsuario(event) {
  try {
    const body = JSON.parse(event.body);
    
    const email = body.email?.toLowerCase().trim() || '';
    const password = body.password || '';
    const tenant_id = body.tenant_id || '';
    
    if (!email || !password || !tenant_id) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Email, password y tenant_id son requeridos' }),
      };
    }
    
    let usuario;
    try {
      const response = await dynamodb.get({
        TableName: TABLE_NAME,
        Key: {
          tenant_id: tenant_id,
          email: email
        }
      }).promise();
      
      if (!response.Item) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Credenciales inválidas' }),
        };
      }
      
      usuario = response.Item;
      
    } catch (error) {
      console.error('Error fetching user:', error);
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Credenciales inválidas' }),
      };
    }
    
    const isValidPassword = await bcrypt.compare(password, usuario.password_hash);
    if (!isValidPassword) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Credenciales inválidas' }),
      };
    }
    
    if (!usuario.is_active) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Usuario desactivado' }),
      };
    }
    
    const payload = {
      user_id: usuario.user_id,
      tenant_id: usuario.tenant_id,
      email: usuario.email,
      role: usuario.role || 'user',
      exp: Math.floor(Date.now() / 1000) + (60 * 60),
      iat: Math.floor(Date.now() / 1000)
    };
    
    const token = jwt.sign(payload, JWT_SECRET);
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        mensaje: 'Login exitoso',
        token: token,
        usuario: {
          user_id: usuario.user_id,
          email: usuario.email,
          nombre: usuario.nombre,
          tenant_id: usuario.tenant_id,
          role: usuario.role || 'user'
        },
        expires_in: 3600
      }),
    };
    
  } catch (error) {
    console.error('Error during login:', error);
    if (error instanceof SyntaxError) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'JSON inválido' }),
      };
    }
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Error interno del servidor' }),
    };
  }
}

export async function validarToken(event) {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Token no proporcionado' }),
      };
    }
    
    const token = authHeader.substring(7);
    
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Token expirado' }),
        };
      } else {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Token inválido' }),
        };
      }
    }
    
    try {
      const response = await dynamodb.get({
        TableName: TABLE_NAME,
        Key: {
          tenant_id: payload.tenant_id,
          email: payload.email
        }
      }).promise();
      
      if (!response.Item || !response.Item.is_active) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Usuario no válido' }),
        };
      }
      
    } catch (error) {
      console.error('Error validating user:', error);
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Error validando usuario' }),
      };
    }
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        valido: true,
        usuario: {
          user_id: payload.user_id,
          email: payload.email,
          tenant_id: payload.tenant_id,
          role: payload.role || 'user'
        }
      }),
    };
    
  } catch (error) {
    console.error('Error validating token:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Error interno del servidor' }),
    };
  }
}
