#!/bin/bash
# =============================================================================
# Feature-Context-Toggle Service Deployment Script
# =============================================================================
# This script builds and deploys the feature-toggle service to Kubernetes
# Usage: ./scripts/deploy.sh [--skip-build] [--registry REGISTRY] [--version VERSION]
# =============================================================================

set -e

# Default values
SKIP_BUILD=false
REGISTRY="confuseimgr.azurecr.io"
VERSION="v1.0.0"
NAMESPACE="confuse"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --registry)
            REGISTRY="$2"
            shift 2
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--skip-build] [--registry REGISTRY] [--version VERSION] [--namespace NAMESPACE]"
            exit 1
            ;;
    esac
done

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(dirname "$SCRIPT_DIR")"
K8S_DIR="$SERVICE_DIR/k8s"
KUBERNETES_DIR="$K8S_DIR"

echo "=== Deploying Feature-Context-Toggle Service ==="
echo "Registry: $REGISTRY"
echo "Version: $VERSION"
echo "Namespace: $NAMESPACE"

# ============================================================================
# Step 1: Build Docker Image (unless skipped)
# ============================================================================
if [ "$SKIP_BUILD" = false ]; then
    echo "Building Docker image..."
    docker build -t "${REGISTRY}/feature-toggle:${VERSION}" "$SERVICE_DIR"
    
    echo "Pushing Docker image..."
    docker push "${REGISTRY}/feature-toggle:${VERSION}"
else
    echo "Skipping build step..."
fi

# ============================================================================
# Step 2: Apply Service Configurations
# ============================================================================
echo "Applying ConfigMap..."
kubectl apply -f "$K8S_DIR/configmap.yaml"

echo "Applying Secret..."
kubectl apply -f "$K8S_DIR/secret.yaml"

# ============================================================================
# Step 3: Update Deployment with Registry
# ============================================================================
echo "Updating deployment with registry..."
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Replace registry placeholder in deployment
sed "s|confuseimgr.azurecr.io|${REGISTRY}|g" "$K8S_DIR/deployment.yaml" > "$TEMP_DIR/deployment.yaml"

echo "Applying deployment..."
kubectl apply -f "$TEMP_DIR/deployment.yaml"

echo "Applying service..."
kubectl apply -f "$K8S_DIR/service.yaml"

# ============================================================================
# Step 4: Wait for Deployment
# ============================================================================
echo "Waiting for deployment to be ready..."
kubectl rollout status deployment/feature-toggle -n "$NAMESPACE" --timeout=300s

# ============================================================================
# Step 5: Verify Deployment
# ============================================================================
echo "Verifying deployment..."
kubectl get pods -l app=feature-toggle -n "$NAMESPACE"
kubectl get services -n "$NAMESPACE" | grep feature-toggle

# ============================================================================
# Step 6: Health Check
# ============================================================================
echo "Performing health check..."
sleep 10

# Check if service is responding
SERVICE_IP=$(kubectl get service feature-toggle -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}')
if [ -n "$SERVICE_IP" ] && [ "$SERVICE_IP" != "<none>" ]; then
    echo "✅ Service deployed successfully!"
    echo "Service IP: $SERVICE_IP"
    echo "HTTP Port: 3099"
else
    echo "❌ Service deployment failed - no service IP found"
    exit 1
fi

echo ""
echo "✅ Feature-Context-Toggle deployment complete!"
echo ""
echo "Next steps:"
echo "1. Test the service: curl http://$SERVICE_IP:3099/health"
echo "2. View logs: kubectl logs -f deployment/feature-toggle -n $NAMESPACE"
echo "3. Test feature flags: curl http://$SERVICE_IP:3099/api/v1/features"
echo "4. Scale if needed: kubectl scale deployment feature-toggle --replicas=3 -n $NAMESPACE"
echo ""
echo "Important: This service provides feature flag management and A/B testing."
