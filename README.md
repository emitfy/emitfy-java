# com.emitfy:emitfy

Official Emitfy API SDK for Java (OpenAPI-typed).

## Install

```xml
<dependency>
  <groupId>com.emitfy</groupId>
  <artifactId>emitfy</artifactId>
  <version>0.3.0</version>
</dependency>
```

## Facade

```java
import com.emitfy.Emitfy;

Emitfy emitfy = new Emitfy(System.getenv("EMITFY_API_KEY"), System.getenv("EMITFY_API_SECRET"));
Emitfy.CompanyContext company = emitfy.company(System.getenv("EMITFY_COMPANY_ID"));
company.nfse.create(Map.of("serviceDescription", "Serviço", "amount", 100));
```

## Typed OpenAPI layer

```java
import com.emitfy.generated.api.WebhooksApi;
import com.emitfy.generated.model.WebhookCreate;

WebhooksApi api = emitfy.webhooksApi();
api.webhooksCreate(new WebhookCreate().url("https://seu-sistema.com/webhooks/emitfy"));
```

Regenerate in the Emitfy monorepo: `pnpm run sdk:generate` (requires JDK).

Docs: https://api.emitfy.com/docs/sdks
