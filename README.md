# com.emitfy:emitfy (Java)

Official Emitfy API SDK for Java 11+.

```xml
<dependency>
  <groupId>com.emitfy</groupId>
  <artifactId>emitfy</artifactId>
  <version>0.2.1</version>
</dependency>
```

```java
import com.emitfy.Emitfy;
import java.util.Map;

Emitfy emitfy = new Emitfy(System.getenv("EMITFY_API_KEY"), System.getenv("EMITFY_API_SECRET"));
emitfy.webhooks.create(Map.of(
  "url", "https://seu-sistema.com/webhooks/emitfy",
  "events", Map.of("invoice", new String[]{"nfse.authorized"}, "cte", new String[]{})
));
Emitfy.CompanyContext company = emitfy.company(System.getenv("EMITFY_COMPANY_ID"));
company.nfse.create(Map.of("serviceDescription", "Serviço", "amount", 100));
```

Docs: https://api.emitfy.com/docs/sdks
