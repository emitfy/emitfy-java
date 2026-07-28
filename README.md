# com.emitfy:emitfy

Official Emitfy API SDK for Java (OpenAPI-typed).

## Install

```xml
<dependency>
  <groupId>com.emitfy</groupId>
  <artifactId>emitfy</artifactId>
  <version>0.3.1</version>
</dependency>
```

## Facade

```java
import com.emitfy.Emitfy;

Emitfy emitfy = new Emitfy(System.getenv("EMITFY_API_KEY"), System.getenv("EMITFY_API_SECRET"));
Emitfy.CompanyContext company = emitfy.company(System.getenv("EMITFY_COMPANY_ID"));
company.nfse.create(Map.of(
  "name", "Consultoria",
  "category", "consulting",
  "serviceDescription", "Consultoria em tecnologia",
  "cityServiceCode", "02800",
  "amount", 100,
  "borrower", Map.of("name", "Cliente LTDA", "taxId", "12.345.678/0001-90")
));
```

## Typed OpenAPI layer

```java
import com.emitfy.generated.api.WebhooksApi;
import com.emitfy.generated.model.WebhookCreate;

WebhooksApi api = emitfy.webhooksApi();
api.webhooksCreate(new WebhookCreate().url("https://seu-sistema.com/webhooks/emitfy"));
```

Docs: https://docs.emitfy.com/sdks  
OpenAPI: https://api.emitfy.com/openapi.yaml
