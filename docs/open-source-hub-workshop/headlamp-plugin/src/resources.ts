import { KubeObject, KubeObjectInterface } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';

export interface Condition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
}

interface InstanceInterface extends KubeObjectInterface {
  spec?: {
    providerRef?: { name?: string };
    topology?: {
      type?: string;
      parameters?: {
        externalAccess?: string;
      };
    };
    components?: Record<
      string,
      {
        type?: string;
        parameters?: {
          modelName?: string;
          modelURI?: string;
        };
      }
    >;
  };
  status?: {
    phase?: string;
    message?: string;
    conditions?: Condition[];
  };
}

export class Instance extends KubeObject<InstanceInterface> {
  static kind = 'Instance';
  static apiName = 'instances';
  static apiVersion = 'core.openeverest.io/v1alpha1';
  static isNamespaced = true;

  get phase(): string {
    return this.jsonData.status?.phase || 'Pending';
  }

  get message(): string {
    return this.jsonData.status?.message || '';
  }

  get provider(): string {
    return this.jsonData.spec?.providerRef?.name || '-';
  }

  get model(): string {
    const components = Object.values(this.jsonData.spec?.components || {});
    return components.find(component => component.parameters?.modelName)?.parameters?.modelName || '-';
  }

  get externalAccess(): string {
    return this.jsonData.spec?.topology?.parameters?.externalAccess || 'ClusterIP';
  }

  get conditions(): Condition[] {
    return this.jsonData.status?.conditions || [];
  }
}

interface ProviderInterface extends KubeObjectInterface {
  status?: {
    phase?: string;
    conditions?: Condition[];
  };
}

export class Provider extends KubeObject<ProviderInterface> {
  static kind = 'Provider';
  static apiName = 'providers';
  static apiVersion = 'core.openeverest.io/v1alpha1';
  static isNamespaced = false;

  get phase(): string {
    return this.jsonData.status?.phase || 'Installed';
  }

  get conditions(): Condition[] {
    return this.jsonData.status?.conditions || [];
  }
}

interface InstanceUserInterface extends KubeObjectInterface {
  spec?: {
    instanceRef?: { name?: string };
    username?: string;
    roles?: Array<{ role?: string }>;
  };
  status?: {
    conditions?: Condition[];
  };
}

export class InstanceUser extends KubeObject<InstanceUserInterface> {
  static kind = 'InstanceUser';
  static apiName = 'instanceusers';
  static apiVersion = 'plugin-user-management.plugins.openeverest.io/v1alpha1';
  static isNamespaced = true;

  get username(): string {
    return this.jsonData.spec?.username || this.metadata.name || '-';
  }

  get instanceName(): string {
    return this.jsonData.spec?.instanceRef?.name || '-';
  }

  get roles(): string {
    return this.jsonData.spec?.roles?.map(role => role.role).filter(Boolean).join(', ') || '-';
  }
}

interface StatusInterface extends KubeObjectInterface {
  status?: Record<string, unknown>;
}

export class Gateway extends KubeObject<StatusInterface> {
  static kind = 'Gateway';
  static apiName = 'gateways';
  static apiVersion = 'gateway.networking.k8s.io/v1';
  static isNamespaced = true;
}

export class AIGatewayRoute extends KubeObject<StatusInterface> {
  static kind = 'AIGatewayRoute';
  static apiName = 'aigatewayroutes';
  static apiVersion = 'aigateway.envoyproxy.io/v1alpha1';
  static isNamespaced = true;
}

export class SecurityPolicy extends KubeObject<StatusInterface> {
  static kind = 'SecurityPolicy';
  static apiName = 'securitypolicies';
  static apiVersion = 'gateway.envoyproxy.io/v1alpha1';
  static isNamespaced = true;
}

interface PodInterface extends KubeObjectInterface {
  status?: {
    phase?: string;
    containerStatuses?: Array<{
      state?: {
        waiting?: {
          reason?: string;
        };
      };
    }>;
  };
}

export class Pod extends KubeObject<PodInterface> {
  static kind = 'Pod';
  static apiName = 'pods';
  static apiVersion = 'v1';
  static isNamespaced = true;

  get issue(): string {
    const phase = this.jsonData.status?.phase || 'Unknown';
    if (phase !== 'Running' && phase !== 'Succeeded') return phase;
    for (const container of this.jsonData.status?.containerStatuses || []) {
      const reason = container.state?.waiting?.reason;
      if (reason) return reason;
    }
    return '';
  }
}

interface EventInterface extends KubeObjectInterface {
  involvedObject?: {
    kind?: string;
    name?: string;
    namespace?: string;
  };
  type?: string;
  reason?: string;
  message?: string;
  eventTime?: string;
  lastTimestamp?: string;
}

export class Event extends KubeObject<EventInterface> {
  static kind = 'Event';
  static apiName = 'events';
  static apiVersion = 'v1';
  static isNamespaced = true;
}
