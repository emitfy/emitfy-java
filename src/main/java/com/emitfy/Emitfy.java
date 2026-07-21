package com.emitfy;

import com.emitfy.generated.ApiClient;
import com.emitfy.generated.api.WebhooksApi;
import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.Objects;
import java.util.StringJoiner;

public final class Emitfy {
    private final HttpTransport transport;
    private final String apiKey;
    private final String apiSecret;
    private final String baseUrl;
    public final Webhooks webhooks;
    public final Companies companies;

    public Emitfy(String apiKey, String apiSecret) {
        this(apiKey, apiSecret, "https://api.emitfy.com/v1", 2);
    }

    public Emitfy(String apiKey, String apiSecret, String baseUrl, int maxRetries) {
        if (apiKey == null || apiKey.isBlank() || apiSecret == null || apiSecret.isBlank()) {
            throw new EmitfyException("apiKey and apiSecret are required.", null, null, 0);
        }
        this.apiKey = apiKey.trim();
        this.apiSecret = apiSecret.trim();
        this.baseUrl = baseUrl.replaceAll("/$", "");
        this.transport = new HttpTransport(this.apiKey, this.apiSecret, this.baseUrl, maxRetries);
        this.webhooks = new Webhooks(transport);
        this.companies = new Companies(transport);
    }

    public CompanyContext company(String companyId) {
        if (companyId == null || companyId.isBlank()) {
            throw new EmitfyException("companyId is required.", null, null, 0);
        }
        return new CompanyContext(transport, companyId.trim());
    }

    /** Client OpenAPI tipado (`com.emitfy.generated.*`). */
    public ApiClient openApiClient() {
        ApiClient client = new ApiClient();
        client.updateBaseUri(baseUrl);
        client.setRequestInterceptor(builder -> {
            builder.header("X-Api-Key", apiKey);
            builder.header("X-Api-Secret", apiSecret);
        });
        return client;
    }

    public WebhooksApi webhooksApi() {
        return new WebhooksApi(openApiClient());
    }

    static final class HttpTransport {
        private final String apiKey;
        private final String apiSecret;
        private final String baseUrl;
        private final int maxRetries;
        private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();
        private final Gson gson = new Gson();

        HttpTransport(String apiKey, String apiSecret, String baseUrl, int maxRetries) {
            this.apiKey = apiKey;
            this.apiSecret = apiSecret;
            this.baseUrl = baseUrl.replaceAll("/$", "");
            this.maxRetries = maxRetries;
        }

        JsonElement request(String method, String path, Object body, String idempotencyKey) {
            int attempt = 0;
            while (true) {
                attempt++;
                try {
                    HttpRequest.Builder builder = HttpRequest.newBuilder()
                        .uri(URI.create(baseUrl + "/" + path.replaceAll("^/", "")))
                        .timeout(Duration.ofSeconds(60))
                        .header("X-Api-Key", apiKey)
                        .header("X-Api-Secret", apiSecret)
                        .header("Accept", "application/json")
                        .header("Content-Type", "application/json");

                    if (idempotencyKey != null && !idempotencyKey.isBlank()) {
                        builder.header("Idempotency-Key", idempotencyKey);
                    }

                    String payload = body == null ? null : gson.toJson(body);
                    builder.method(method.toUpperCase(), payload == null
                        ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(payload));

                    HttpResponse<String> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
                    int status = response.statusCode();

                    if (status == 429 && attempt <= maxRetries + 1) {
                        String retryAfter = response.headers().firstValue("Retry-After").orElse("1");
                        Thread.sleep(Math.max(1, Integer.parseInt(retryAfter)) * 1000L);
                        continue;
                    }

                    String raw = response.body() == null ? "" : response.body();
                    JsonElement decoded = raw.isBlank() ? null : JsonParser.parseString(raw);

                    if (status >= 400) {
                        String message = "Request failed.";
                        String code = null;
                        JsonElement details = null;
                        if (decoded != null && decoded.isJsonObject() && decoded.getAsJsonObject().has("error")) {
                            JsonObject error = decoded.getAsJsonObject().getAsJsonObject("error");
                            if (error.has("message")) {
                                message = error.get("message").getAsString();
                            }
                            if (error.has("code") && !error.get("code").isJsonNull()) {
                                code = error.get("code").getAsString();
                            }
                            if (error.has("details")) {
                                details = error.get("details");
                            }
                        }
                        throw new EmitfyException(message, code, details, status);
                    }

                    if (decoded != null && decoded.isJsonObject() && decoded.getAsJsonObject().has("data")) {
                        return decoded.getAsJsonObject().get("data");
                    }
                    return decoded;
                } catch (EmitfyException e) {
                    throw e;
                } catch (Exception e) {
                    throw new EmitfyException(e.getMessage() == null ? "HTTP request failed." : e.getMessage(), null, null, 0);
                }
            }
        }
    }

    public static final class Webhooks {
        private final HttpTransport transport;

        Webhooks(HttpTransport transport) {
            this.transport = transport;
        }

        public JsonElement list() {
            return transport.request("GET", "/webhooks", null, null);
        }

        public JsonElement create(Object payload) {
            return transport.request("POST", "/webhooks", payload, null);
        }

        public JsonElement update(String id, Object payload) {
            return transport.request("PUT", "/webhooks/" + enc(id), payload, null);
        }

        public JsonElement setActive(String id, boolean active) {
            return transport.request("PATCH", "/webhooks/" + enc(id) + "/active", Map.of("active", active), null);
        }

        public JsonElement delete(String id) {
            return transport.request("DELETE", "/webhooks/" + enc(id), null, null);
        }
    }

    public static final class Companies {
        private final HttpTransport transport;

        Companies(HttpTransport transport) {
            this.transport = transport;
        }

        public JsonElement list() {
            return transport.request("GET", "/companies", null, null);
        }

        public JsonElement create(Object payload) {
            return transport.request("POST", "/companies", payload, null);
        }
    }

    public static final class CompanyResource {
        private final HttpTransport transport;
        private final String basePath;

        CompanyResource(HttpTransport transport, String basePath) {
            this.transport = transport;
            this.basePath = basePath;
        }

        public JsonElement list() {
            return transport.request("GET", basePath, null, null);
        }

        public JsonElement list(Map<String, ?> query) {
            if (query == null || query.isEmpty()) {
                return list();
            }
            StringJoiner joiner = new StringJoiner("&");
            for (Map.Entry<String, ?> entry : query.entrySet()) {
                joiner.add(enc(entry.getKey()) + "=" + enc(String.valueOf(entry.getValue())));
            }
            return transport.request("GET", basePath + "?" + joiner, null, null);
        }

        public JsonElement create(Object payload) {
            return create(payload, null);
        }

        public JsonElement create(Object payload, String idempotencyKey) {
            return transport.request("POST", basePath, payload, idempotencyKey);
        }

        public JsonElement get(String id) {
            return transport.request("GET", basePath + "/" + enc(id), null, null);
        }

        public JsonElement update(String id, Object payload) {
            return transport.request("PUT", basePath + "/" + enc(id), payload, null);
        }

        public JsonElement delete(String id) {
            return transport.request("DELETE", basePath + "/" + enc(id), null, null);
        }

        public JsonElement post(String suffix, Object payload, String idempotencyKey) {
            return transport.request("POST", basePath.replaceAll("/$", "") + "/" + suffix.replaceAll("^/", ""), payload, idempotencyKey);
        }
    }

    public static final class CompanyContext {
        private final HttpTransport transport;
        private final String companyId;
        public final CompanyResource nfse;
        public final CompanyResource nfe;
        public final CompanyResource nfce;
        public final CompanyResource cte;
        public final CompanyResource customers;
        public final CompanyResource products;
        public final CompanyResource invoices;
        public final CompanyResource receivedNfes;

        CompanyContext(HttpTransport transport, String companyId) {
            this.transport = transport;
            this.companyId = companyId;
            String prefix = "/companies/" + enc(companyId);
            this.nfse = new CompanyResource(transport, prefix + "/nfse");
            this.nfe = new CompanyResource(transport, prefix + "/nfe");
            this.nfce = new CompanyResource(transport, prefix + "/nfce");
            this.cte = new CompanyResource(transport, prefix + "/cte");
            this.customers = new CompanyResource(transport, prefix + "/customers");
            this.products = new CompanyResource(transport, prefix + "/products");
            this.invoices = new CompanyResource(transport, prefix + "/invoices");
            this.receivedNfes = new CompanyResource(transport, prefix + "/received-nfes");
        }

        public String id() {
            return companyId;
        }

        public JsonElement createCteOs(Object payload, String idempotencyKey) {
            return transport.request("POST", "/companies/" + enc(companyId) + "/cte-os", payload, idempotencyKey);
        }
    }

    private static String enc(String value) {
        return URLEncoder.encode(Objects.requireNonNull(value), StandardCharsets.UTF_8);
    }
}
