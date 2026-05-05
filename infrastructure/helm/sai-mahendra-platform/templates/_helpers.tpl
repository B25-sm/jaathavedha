{{/*
Expand the name of the chart.
*/}}
{{- define "sai-mahendra-platform.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "sai-mahendra-platform.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "sai-mahendra-platform.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "sai-mahendra-platform.labels" -}}
helm.sh/chart: {{ include "sai-mahendra-platform.chart" . }}
{{ include "sai-mahendra-platform.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
environment: {{ .Values.global.environment }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "sai-mahendra-platform.selectorLabels" -}}
app.kubernetes.io/name: {{ include "sai-mahendra-platform.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "sai-mahendra-platform.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "sai-mahendra-platform.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Generate image name
*/}}
{{- define "sai-mahendra-platform.image" -}}
{{- $registry := .Values.global.imageRegistry -}}
{{- $repository := .repository -}}
{{- $tag := .tag | default "latest" -}}
{{- printf "%s/%s:%s" $registry $repository $tag -}}
{{- end }}

{{/*
Generate service name
*/}}
{{- define "sai-mahendra-platform.serviceName" -}}
{{- $name := . -}}
{{- $name | kebabcase -}}
{{- end }}

{{/*
Generate full service URL
*/}}
{{- define "sai-mahendra-platform.serviceUrl" -}}
{{- $name := . -}}
{{- $namespace := $.Values.global.namespace -}}
{{- printf "http://%s.%s.svc.cluster.local" ($name | kebabcase) $namespace -}}
{{- end }}
