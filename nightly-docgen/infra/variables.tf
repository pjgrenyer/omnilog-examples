variable "aws_region" {
  type        = string
  default     = "eu-west-2"
  description = "AWS region to deploy resources into"
}

variable "aws_access_key" {
  type        = string
  default     = null
  sensitive   = true
  description = "AWS access key ID. Supplied via TF_VAR_aws_access_key from secrets.env (never committed). Leave null to fall back to the default AWS credential chain."
}

variable "aws_secret_key" {
  type        = string
  default     = null
  sensitive   = true
  description = "AWS secret access key. Supplied via TF_VAR_aws_secret_key from secrets.env (never committed). Leave null to fall back to the default AWS credential chain."
}

variable "project" {
  type        = string
  default     = "omnilog-nightly-docgen"
  description = "Project name used for resource naming and tagging"
}

variable "otel_exporter_otlp_endpoint" {
  type        = string
  sensitive   = true
  description = "The OTLP endpoint Omnilog issued for your tenant, e.g. https://<api-id>.execute-api.eu-west-2.amazonaws.com/prod. Supplied via TF_VAR_otel_exporter_otlp_endpoint from secrets.env."
}

variable "otel_exporter_otlp_headers" {
  type        = string
  sensitive   = true
  description = "The OTLP auth header Omnilog issued for your tenant, e.g. x-api-key=<your-api-key>. Supplied via TF_VAR_otel_exporter_otlp_headers from secrets.env."
}

variable "total_docs" {
  type        = number
  default     = 3000
  description = "Documents the run should produce over the whole window, spread evenly across ticks. Overridable with TF_VAR_total_docs."
}

variable "tick_minutes" {
  type        = number
  default     = 5
  description = "How often the EventBridge rule invokes the Lambda, all day — the handler no-ops outside the configured window, so this just sets the schedule's granularity. Overridable with TF_VAR_tick_minutes."
}

variable "window_start_hour" {
  type        = number
  default     = 1
  description = "UTC hour (0-23) the overnight generation window opens. Overridable with TF_VAR_window_start_hour."
}

variable "window_end_hour" {
  type        = number
  default     = 5
  description = "UTC hour (0-23) the overnight generation window closes. May be less than window_start_hour to express a window that crosses midnight. Overridable with TF_VAR_window_end_hour."
}

variable "failure_rate" {
  type        = number
  default     = 0.05
  description = "Fraction of documents whose S3 upload is randomly, deliberately failed, to produce a realistic error path. Overridable with TF_VAR_failure_rate."
}
