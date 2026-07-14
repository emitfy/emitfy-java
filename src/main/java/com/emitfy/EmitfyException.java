package com.emitfy;

public final class EmitfyException extends RuntimeException {
    private final String code;
    private final Object details;
    private final int statusCode;

    public EmitfyException(String message, String code, Object details, int statusCode) {
        super(message);
        this.code = code;
        this.details = details;
        this.statusCode = statusCode;
    }

    public String getCode() {
        return code;
    }

    public Object getDetails() {
        return details;
    }

    public int getStatusCode() {
        return statusCode;
    }
}
