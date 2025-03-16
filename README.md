# titvo-lambda-shared

Biblioteca compartida de utilidades para aplicaciones serverless en AWS Lambda con NestJS.

## Descripción

`titvo-lambda-shared` es una biblioteca de utilidades diseñada para facilitar el desarrollo de aplicaciones serverless en AWS Lambda utilizando NestJS. Proporciona una serie de servicios, módulos y utilidades para interactuar con diversos servicios de AWS y simplificar tareas comunes en aplicaciones serverless.

## Instalación

```bash
npm install titvo-lambda-shared
```

## Características

- **Circuit Breaker**: Implementación del patrón Circuit Breaker para manejar fallos en servicios externos.
- **Lambda Service**: Utilidades para invocar y gestionar funciones AWS Lambda.
- **Parameter Service**: Acceso simplificado a parámetros almacenados en AWS SSM Parameter Store.
- **SFN Service**: Interacción con AWS Step Functions.
- **XML Builder**: Herramientas para construir documentos XML.
- **Validación**: Utilidades para validar DTOs.
- **Utilidades**: Conjunto de funciones de utilidad para fechas, tiempos y más.
- **Batch**: Integración con AWS Batch.
- **Storage**: Utilidades para interactuar con servicios de almacenamiento como S3.

## Uso

```typescript
import { LambdaService, ParameterService } from 'titvo-lambda-shared';

// Ejemplo de uso con NestJS
@Module({
  imports: [
    LambdaModule.forRoot({
      region: 'us-east-1'
    }),
    ParameterModule.forRoot({
      region: 'us-east-1'
    })
  ],
  providers: [YourService],
})
export class YourModule {}

// En tu servicio
@Injectable()
class YourService {
  constructor(
    private readonly lambdaService: LambdaService,
    private readonly parameterService: ParameterService
  ) {}

  async doSomething() {
    // Invocar una función Lambda
    const result = await this.lambdaService.invoke('your-function-name', { data: 'example' });
    
    // Obtener un parámetro de SSM
    const parameter = await this.parameterService.getParameter('/path/to/parameter');
  }
}
```

## Dependencias

Esta biblioteca tiene como dependencias de pares varios paquetes de AWS SDK y NestJS. Asegúrate de tener instaladas las versiones correctas en tu proyecto.

## Licencia

ISC
