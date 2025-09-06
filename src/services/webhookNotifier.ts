import { query } from '@/lib/db';
import { CreditAlert } from './creditMonitor';

export interface WebhookConfig {
  id: string;
  workspace_id?: string;
  is_global: boolean;
  webhook_url: string;
  webhook_name: string;
  event_types: string[];
  balance_threshold?: number;
  severity_threshold?: string;
  http_method: string;
  headers: Record<string, string>;
  auth_type: string;
  auth_config: Record<string, any>;
  timeout_seconds: number;
  max_retries: number;
  retry_delay_seconds: number;
  is_active: boolean;
}

export interface NotificationEvent {
  event_type: 'low_balance' | 'critical_balance' | 'auto_suspension' | 'recharge' | 'reactivation';
  workspace_id: string;
  workspace_name: string;
  current_balance: number;
  currency: string;
  threshold?: number;
  alert_message: string;
  severity: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface WebhookDeliveryResult {
  success: boolean;
  webhook_id: string;
  status_code?: number;
  response_body?: string;
  error_message?: string;
  delivery_time_ms: number;
  attempt_number: number;
}

export class WebhookNotifier {

  /**
   * Envoyer notification à tous les webhooks configurés
   */
  async sendNotification(event: NotificationEvent): Promise<WebhookDeliveryResult[]> {
    try {
      // Récupérer webhooks applicables
      const webhooks = await this.getApplicableWebhooks(event);
      
      if (webhooks.length === 0) {
        console.log(`No applicable webhooks found for event ${event.event_type} on workspace ${event.workspace_id}`);
        return [];
      }

      const deliveryResults: WebhookDeliveryResult[] = [];

      // Envoyer à chaque webhook
      for (const webhook of webhooks) {
        const result = await this.deliverWebhook(webhook, event);
        deliveryResults.push(result);

        // Mettre à jour statut webhook
        await this.updateWebhookStatus(webhook.id, result);
      }

      return deliveryResults;

    } catch (error) {
      console.error('Error sending webhook notifications:', error);
      return [];
    }
  }

  /**
   * Récupérer webhooks applicables pour l'événement
   */
  private async getApplicableWebhooks(event: NotificationEvent): Promise<WebhookConfig[]> {
    try {
      const result = await query(`
        SELECT * FROM webhook_configurations 
        WHERE is_active = true
          AND (
            (is_global = true) 
            OR (workspace_id = $1)
          )
          AND $2 = ANY(event_types)
          AND (
            severity_threshold IS NULL 
            OR $3 >= (
              CASE severity_threshold
                WHEN 'info' THEN 0
                WHEN 'warning' THEN 1  
                WHEN 'critical' THEN 2
                WHEN 'emergency' THEN 3
                ELSE 0
              END
            )
          )
          AND (
            balance_threshold IS NULL 
            OR $4 <= balance_threshold
          )
        ORDER BY is_global DESC, created_at ASC
      `, [
        event.workspace_id,
        event.event_type,
        this.getSeverityLevel(event.severity),
        event.current_balance
      ]);

      return result.rows;
    } catch (error) {
      console.error('Error fetching applicable webhooks:', error);
      return [];
    }
  }

  /**
   * Livrer webhook avec retry logic
   */
  private async deliverWebhook(webhook: WebhookConfig, event: NotificationEvent): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();
    
    for (let attempt = 1; attempt <= webhook.max_retries; attempt++) {
      try {
        const payload = this.buildWebhookPayload(webhook, event);
        const headers = this.buildHeaders(webhook);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), webhook.timeout_seconds * 1000);

        const response = await fetch(webhook.webhook_url, {
          method: webhook.http_method,
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        
        const deliveryTime = Date.now() - startTime;
        const responseText = await response.text().catch(() => '');

        if (response.ok) {
          return {
            success: true,
            webhook_id: webhook.id,
            status_code: response.status,
            response_body: responseText,
            delivery_time_ms: deliveryTime,
            attempt_number: attempt
          };
        } else {
          // Si pas la dernière tentative, retry
          if (attempt < webhook.max_retries) {
            await this.delay(webhook.retry_delay_seconds * 1000);
            continue;
          }

          return {
            success: false,
            webhook_id: webhook.id,
            status_code: response.status,
            error_message: `HTTP ${response.status}: ${responseText}`,
            delivery_time_ms: deliveryTime,
            attempt_number: attempt
          };
        }

      } catch (error: any) {
        // Si pas la dernière tentative, retry
        if (attempt < webhook.max_retries) {
          await this.delay(webhook.retry_delay_seconds * 1000);
          continue;
        }

        return {
          success: false,
          webhook_id: webhook.id,
          error_message: error.message || 'Network error',
          delivery_time_ms: Date.now() - startTime,
          attempt_number: attempt
        };
      }
    }

    // Fallback (ne devrait jamais arriver)
    return {
      success: false,
      webhook_id: webhook.id,
      error_message: 'Max retries exceeded',
      delivery_time_ms: Date.now() - startTime,
      attempt_number: webhook.max_retries
    };
  }

  /**
   * Construire payload webhook
   */
  private buildWebhookPayload(webhook: WebhookConfig, event: NotificationEvent): any {
    return {
      webhook_name: webhook.webhook_name,
      timestamp: event.timestamp,
      event: {
        type: event.event_type,
        workspace: {
          id: event.workspace_id,
          name: event.workspace_name
        },
        credit: {
          current_balance: event.current_balance,
          currency: event.currency,
          threshold: event.threshold
        },
        alert: {
          message: event.alert_message,
          severity: event.severity
        },
        metadata: event.metadata || {}
      },
      platform: {
        name: 'Whispey',
        environment: process.env.NODE_ENV || 'development'
      }
    };
  }

  /**
   * Construire headers HTTP
   */
  private buildHeaders(webhook: WebhookConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Whispey-Webhook/1.0',
      ...webhook.headers
    };

    // Ajouter authentification
    switch (webhook.auth_type) {
      case 'bearer':
        if (webhook.auth_config.token) {
          headers['Authorization'] = `Bearer ${webhook.auth_config.token}`;
        }
        break;
      
      case 'basic':
        if (webhook.auth_config.username && webhook.auth_config.password) {
          const credentials = Buffer.from(`${webhook.auth_config.username}:${webhook.auth_config.password}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
        
      case 'api_key':
        if (webhook.auth_config.key && webhook.auth_config.value) {
          headers[webhook.auth_config.key] = webhook.auth_config.value;
        }
        break;
    }

    return headers;
  }

  /**
   * Mettre à jour statut du webhook
   */
  private async updateWebhookStatus(webhook_id: string, result: WebhookDeliveryResult): Promise<void> {
    try {
      if (result.success) {
        await query(`
          UPDATE webhook_configurations 
          SET last_triggered_at = NOW(),
              last_success_at = NOW(),
              updated_at = NOW()
          WHERE id = $1
        `, [webhook_id]);
      } else {
        await query(`
          UPDATE webhook_configurations 
          SET last_triggered_at = NOW(),
              last_error_at = NOW(),
              last_error_message = $2,
              updated_at = NOW()
          WHERE id = $1
        `, [webhook_id, result.error_message]);
      }
    } catch (error) {
      console.error('Error updating webhook status:', error);
    }
  }

  /**
   * Convertir sévérité en niveau numérique
   */
  private getSeverityLevel(severity: string): number {
    switch (severity) {
      case 'info': return 0;
      case 'warning': return 1;
      case 'critical': return 2;
      case 'emergency': return 3;
      default: return 0;
    }
  }

  /**
   * Délai pour retry
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Tester un webhook
   */
  async testWebhook(webhook_id: string): Promise<WebhookDeliveryResult> {
    try {
      const webhookResult = await query(`
        SELECT * FROM webhook_configurations WHERE id = $1 AND is_active = true
      `, [webhook_id]);

      if (webhookResult.rows.length === 0) {
        return {
          success: false,
          webhook_id,
          error_message: 'Webhook not found or inactive',
          delivery_time_ms: 0,
          attempt_number: 1
        };
      }

      const webhook = webhookResult.rows[0];

      // Créer événement de test
      const testEvent: NotificationEvent = {
        event_type: 'low_balance',
        workspace_id: 'test-workspace-id',
        workspace_name: 'Test Workspace',
        current_balance: 10.50,
        currency: 'USD',
        threshold: 25.00,
        alert_message: 'This is a test webhook notification from Whispey',
        severity: 'info',
        timestamp: new Date().toISOString(),
        metadata: {
          test: true,
          webhook_test_id: crypto.randomUUID()
        }
      };

      return await this.deliverWebhook(webhook, testEvent);

    } catch (error: any) {
      return {
        success: false,
        webhook_id,
        error_message: error.message,
        delivery_time_ms: 0,
        attempt_number: 1
      };
    }
  }

  /**
   * Créer notification depuis alerte
   */
  static fromCreditAlert(alert: CreditAlert, workspaceName: string): NotificationEvent {
    return {
      event_type: alert.alert_type as any,
      workspace_id: alert.workspace_id,
      workspace_name: workspaceName,
      current_balance: alert.current_balance,
      currency: alert.currency,
      threshold: alert.threshold,
      alert_message: alert.alert_message,
      severity: alert.severity,
      timestamp: alert.created_at
    };
  }
}

// Instance singleton
export const webhookNotifier = new WebhookNotifier();
