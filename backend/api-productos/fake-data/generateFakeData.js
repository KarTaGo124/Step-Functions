import AWS from 'aws-sdk';
import { faker } from '@faker-js/faker';
import { v4 as uuidv4 } from 'uuid';

AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const PRODUCTOS_TABLE = 'productos-dev';
const TENANT_ID = 'tenant1';
const ADMIN_USER_ID = '73c16057-14ac-4ca5-a064-f1046c0002e5';

function generarProducto() {
  const categoria = faker.commerce.department();
  const nombre = faker.commerce.productName();
  const descripcion = faker.commerce.productDescription();
  const precio = parseFloat(faker.commerce.price({ min: 10, max: 2000, dec: 2 }));
  const stock = faker.number.int({ min: 0, max: 100 });
  const codigo = uuidv4().substring(0, 8).toUpperCase();
  
  return {
    tenant_id: TENANT_ID,
    codigo: codigo,
    nombre: nombre,
    descripcion: descripcion,
    precio: precio,
    categoria: categoria,
    stock: stock,
    created_at: new Date().toISOString(),
    created_by: ADMIN_USER_ID
  };
}

async function insertarProductosBatch(productos) {
  const params = {
    RequestItems: {
      [PRODUCTOS_TABLE]: productos.map(producto => ({
        PutRequest: {
          Item: producto
        }
      }))
    }
  };
  
  try {
    await dynamodb.batchWrite(params).promise();
    return true;
  } catch (error) {
    console.error('Error en batch:', error);
    return false;
  }
}

async function generarProductosFalsos(cantidad = 50) {
  console.log(`Generando ${cantidad} productos para ${TENANT_ID}...`);
  
  const batchSize = 25;
  const totalBatches = Math.ceil(cantidad / batchSize);
  let productosCreados = 0;
  
  for (let batch = 0; batch < totalBatches; batch++) {
    const productosEnBatch = Math.min(batchSize, cantidad - productosCreados);
    const productos = [];
    
    for (let i = 0; i < productosEnBatch; i++) {
      productos.push(generarProducto());
    }
    
    const exito = await insertarProductosBatch(productos);
    if (exito) {
      productosCreados += productos.length;
      console.log(`Batch ${batch + 1}/${totalBatches} completado. Total: ${productosCreados}`);
    } else {
      console.log(`Error en batch ${batch + 1}`);
    }
    
    if (batch < totalBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`Completado: ${productosCreados} productos creados`);
}

generarProductosFalsos(10000)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
