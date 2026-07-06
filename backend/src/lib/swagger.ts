import swaggerJsdoc from 'swagger-jsdoc';

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Fiora API',
      version: '1.0.0',
      description: 'API REST del backend Fiora — fase 1 (autenticazione).',
    },
    servers: [{ url: '/', description: 'Server corrente' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: [
    process.env.NODE_ENV === 'production' ? './dist/routes/*.js' : './src/routes/*.ts',
  ],
});
