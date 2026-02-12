/**
 * Feature Toggle gRPC Server
 * 
 * Implements the FeatureToggle gRPC service defined in proto/toggle.proto
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { logger } from './logger';

// Load proto file
const PROTO_PATH = path.join(__dirname, '..', 'proto', 'toggle.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

// Load package
const toggleProto = grpc.loadPackageDefinition(packageDefinition).confuse.toggle.v1 as any;

/**
 * FeatureToggle service implementation
 */
class FeatureToggleService {
    async GetToggle(call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) {
        const { name } = call.request;
        logger.info('gRPC GetToggle called', { name });

        // TODO: Implement by calling existing toggle retrieval logic
        callback(new Error('Not yet implemented'), null);
    }

    async ListToggles(call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) {
        logger.info('gRPC ListToggles called');

        // TODO: Implement by calling existing toggles list logic
        callback(new Error('Not yet implemented'), null);
    }

    async UpdateToggle(call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) {
        const { name, enabled } = call.request;
        logger.info('gRPC UpdateToggle called', { name, enabled });

        // TODO: Implement by calling existing toggle update logic
        callback(new Error('Not yet implemented'), null);
    }
}

/**
 * Start the gRPC server
 */
export async function startGrpcServer() {
    const server = new grpc.Server();
    const service = new FeatureToggleService();

    // Add service
    server.addService(toggleProto.FeatureToggle.service, {
        GetToggle: service.GetToggle.bind(service),
        ListToggles: service.ListToggles.bind(service),
        UpdateToggle: service.UpdateToggle.bind(service),
    });

    // Bind server
    const grpcPort = process.env.GRPC_PORT || '50057';
    server.bindAsync(
        `0.0.0.0:${grpcPort}`,
        grpc.ServerCredentials.createInsecure(),
        (err, port) => {
            if (err) {
                logger.error('Failed to start gRPC server', { error: err.message });
                throw err;
            }

            logger.info(`feature-context-toggle gRPC server started on port ${port}`);
            server.start();
        }
    );

    return server;
}
