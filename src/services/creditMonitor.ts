import { query } from '@/lib/db';
import { creditManager } from './creditManager';
import { webhookNotifier, NotificationEvent } from './webhookNotifier';

export interface CreditAlert {
  id: string;
  workspace_id: string;
  alert_type: 'low_balance' | 'critical_balance' | 'negative_balance' | 'auto_suspension';
  current_balance: number;
  threshold: number;
  currency: string;
  alert_message: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  is_resolved: boolean;
  created_at: string;
  resolved_at?: string;
}

export interface MonitoringResult {
  total_workspaces_checked: number;
  alerts_generated: number;
  suspensions_triggered: number;
  alerts: CreditAlert[];
  suspended_workspaces: string[];
}

export class CreditMonitor {

  /**
   * Surveiller workspaces spécifiques pour balance de crédits
   */
  async monitorSpecificWorkspaces(workspaceIds: string[], enableAutoActions: boolean = true): Promise<MonitoringResult> {
    try {
      const placeholders = workspaceIds.map((_, index) => `$${index + 1}`).join(', ');
      
      // Récupérer workspaces spécifiés avec leurs crédits
      const workspacesResult = await query(`
        SELECT 
          p.id as workspace_id,
          p.project_name,
          uc.id as credit_id,
          uc.current_balance,
          uc.currency,
          uc.low_balance_threshold,
          uc.credit_limit,
          uc.auto_recharge_enabled,
          uc.auto_recharge_threshold,
          uc.auto_recharge_amount,
          uc.is_suspended
        FROM pype_voice_projects p
        INNER JOIN user_credits uc ON uc.workspace_id = p.id
        WHERE uc.is_active = true AND p.id IN (${placeholders})
        ORDER BY uc.current_balance ASC
      `, workspaceIds);

      return await this.processWorkspaceMonitoring(workspacesResult.rows, enableAutoActions);

    } catch (error) {
      console.error('Error monitoring specific workspaces:', error);
      throw error;
    }
  }

  /**
   * Surveiller tous les workspaces pour balance de crédits
   */
  async monitorAllWorkspaces(): Promise<MonitoringResult> {
    try {
      // Récupérer tous les workspaces avec leurs crédits
      const workspacesResult = await query(`
        SELECT 
          p.id as workspace_id,
          p.project_name,
          uc.id as credit_id,
          uc.current_balance,
          uc.currency,
          uc.low_balance_threshold,
          uc.credit_limit,
          uc.auto_recharge_enabled,
          uc.auto_recharge_threshold,
          uc.auto_recharge_amount,
          uc.is_suspended
        FROM pype_voice_projects p
        INNER JOIN user_credits uc ON uc.workspace_id = p.id
        WHERE uc.is_active = true
        ORDER BY uc.current_balance ASC
      `);

      return await this.processWorkspaceMonitoring(workspacesResult.rows, true);

    } catch (error) {
      console.error('Error monitoring all workspaces:', error);
      throw error;
    }
  }

  /**
   * Traiter le monitoring des workspaces (logique commune)
   */
  private async processWorkspaceMonitoring(workspaces: any[], enableAutoActions: boolean = true): Promise<MonitoringResult> {
    try {
      let alertsGenerated = 0;
      let suspensionsTriggered = 0;
      const alerts: CreditAlert[] = [];
      const suspendedWorkspaces: string[] = [];

      for (const workspace of workspaces) {
        const {
          workspace_id,
          project_name,
          current_balance,
          currency,
          low_balance_threshold,
          credit_limit,
          auto_recharge_enabled,
          auto_recharge_threshold,
          auto_recharge_amount,
          is_suspended
        } = workspace;

        // Skip si déjà suspendu
        if (is_suspended) continue;

        // 1. Vérifier balance négative (suspension automatique)
        if (current_balance < 0) {
          await this.triggerAutoSuspension(workspace_id, current_balance, currency);
          suspensionsTriggered++;
          suspendedWorkspaces.push(workspace_id);
          
          alerts.push(await this.generateAlert(
            workspace_id,
            'auto_suspension',
            current_balance,
            0,
            currency,
            `Workspace ${project_name} suspended due to negative balance: ${current_balance} ${currency}`,
            'emergency'
          ));
          alertsGenerated++;
          continue;
        }

        // 2. Vérifier recharge automatique si activée
        if (auto_recharge_enabled && current_balance <= auto_recharge_threshold) {
          const rechargeResult = await this.processAutoRecharge(
            workspace_id, auto_recharge_amount, currency
          );
          
          if (rechargeResult.success) {
            alerts.push(await this.generateAlert(
              workspace_id,
              'low_balance',
              current_balance,
              auto_recharge_threshold,
              currency,
              `Auto-recharge triggered: +${auto_recharge_amount} ${currency}. New balance: ${rechargeResult.new_balance}`,
              'info'
            ));
            alertsGenerated++;
            continue; // Skip autres vérifications car rechargé
          }
        }

        // 3. Vérifier balance critique (proche de 0)
        if (current_balance <= 5.00) {
          alerts.push(await this.generateAlert(
            workspace_id,
            'critical_balance',
            current_balance,
            5.00,
            currency,
            `Critical balance warning for ${project_name}: ${current_balance} ${currency} remaining`,
            'critical'
          ));
          alertsGenerated++;
        }
        // 4. Vérifier seuil de balance faible
        else if (current_balance <= low_balance_threshold) {
          alerts.push(await this.generateAlert(
            workspace_id,
            'low_balance',
            current_balance,
            low_balance_threshold,
            currency,
            `Low balance alert for ${project_name}: ${current_balance} ${currency} (threshold: ${low_balance_threshold})`,
            'warning'
          ));
          alertsGenerated++;
        }
      }

      return {
        total_workspaces_checked: workspaces.length,
        alerts_generated: alertsGenerated,
        suspensions_triggered: suspensionsTriggered,
        alerts,
        suspended_workspaces: suspendedWorkspaces
      };

    } catch (error) {
      console.error('Error monitoring workspaces:', error);
      throw error;
    }
  }

  /**
   * Générer et enregistrer alerte + envoyer webhook notifications
   */
  private async generateAlert(
    workspace_id: string,
    alert_type: CreditAlert['alert_type'],
    current_balance: number,
    threshold: number,
    currency: string,
    alert_message: string,
    severity: CreditAlert['severity'],
    workspace_name?: string
  ): Promise<CreditAlert> {
    const result = await query(`
      INSERT INTO credit_alerts (
        workspace_id, alert_type, current_balance, threshold,
        currency, alert_message, severity, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `, [workspace_id, alert_type, current_balance, threshold, currency, alert_message, severity]);

    const alert = result.rows[0];

    // Envoyer notifications webhook asynchrones
    this.sendWebhookNotification(alert, workspace_name).catch(error => {
      console.error('Error sending webhook notification:', error);
    });

    return alert;
  }

  /**
   * Envoyer notification webhook pour une alerte
   */
  private async sendWebhookNotification(alert: CreditAlert, workspace_name?: string): Promise<void> {
    try {
      // Récupérer nom du workspace si pas fourni
      if (!workspace_name) {
        const workspaceResult = await query(`
          SELECT project_name FROM pype_voice_projects WHERE id = $1
        `, [alert.workspace_id]);
        
        workspace_name = workspaceResult.rows[0]?.project_name || 'Unknown Workspace';
      }

      // Créer événement de notification
      const notificationEvent: NotificationEvent = {
        event_type: this.mapAlertTypeToEventType(alert.alert_type),
        workspace_id: alert.workspace_id,
        workspace_name: workspace_name || 'Unknown Workspace',
        current_balance: alert.current_balance,
        currency: alert.currency,
        threshold: alert.threshold,
        alert_message: alert.alert_message,
        severity: alert.severity,
        timestamp: alert.created_at,
        metadata: {
          alert_id: alert.id,
          alert_type: alert.alert_type
        }
      };

      // Envoyer notification
      await webhookNotifier.sendNotification(notificationEvent);

    } catch (error) {
      console.error('Failed to send webhook notification:', error);
    }
  }

  /**
   * Mapper type d'alerte vers type d'événement webhook
   */
  private mapAlertTypeToEventType(alertType: string): NotificationEvent['event_type'] {
    switch (alertType) {
      case 'auto_suspension':
        return 'auto_suspension';
      case 'low_balance':
        return 'low_balance';
      case 'critical_balance':
        return 'critical_balance';
      case 'negative_balance':
        return 'critical_balance'; // Mapper vers critical_balance
      default:
        return 'low_balance';
    }
  }

  /**
   * Déclencher suspension automatique
   */
  private async triggerAutoSuspension(
    workspace_id: string,
    current_balance: number,
    currency: string
  ): Promise<void> {
    try {
      await query('BEGIN');

      // 1. Suspendre workspace
      await query(`
        UPDATE user_credits 
        SET is_suspended = true,
            suspension_reason = 'Automatic suspension due to negative balance',
            suspended_at = NOW(),
            updated_at = NOW()
        WHERE workspace_id = $1 AND is_active = true
      `, [workspace_id]);

      // 2. Désactiver tous les agents
      await query(`
        UPDATE pype_voice_agents 
        SET is_active = false,
            updated_at = NOW()
        WHERE project_id = $1 AND is_active = true
      `, [workspace_id]);

      // 3. Désactiver toutes les KB
      await query(`
        UPDATE pype_voice_knowledge_bases 
        SET is_active = false,
            updated_at = NOW()
        WHERE workspace_id = $1 AND is_active = true
      `, [workspace_id]);

      // 4. Enregistrer transaction
      await query(`
        INSERT INTO credit_transactions (
          workspace_id, user_id, credits_id, transaction_type, amount,
          previous_balance, new_balance, description, status, created_at
        )
        SELECT 
          $1, NULL, uc.id, 'suspension', 0,
          uc.current_balance, uc.current_balance,
          $2, 'completed', NOW()
        FROM user_credits uc
        WHERE uc.workspace_id = $1 AND uc.is_active = true
      `, [workspace_id, `Auto-suspension: negative balance ${current_balance} ${currency}`]);

      await query('COMMIT');
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Traiter recharge automatique
   */
  private async processAutoRecharge(
    workspace_id: string,
    recharge_amount: number,
    currency: string
  ): Promise<{ success: boolean; new_balance?: number; error?: string }> {
    try {
      await query('BEGIN');

      const result = await query(`
        UPDATE user_credits 
        SET current_balance = current_balance + $2,
            updated_at = NOW()
        WHERE workspace_id = $1 AND is_active = true
        RETURNING current_balance
      `, [workspace_id, recharge_amount]);

      if (result.rows.length === 0) {
        await query('ROLLBACK');
        return { success: false, error: 'Workspace credits not found' };
      }

      const new_balance = result.rows[0].current_balance;

      // Enregistrer transaction de recharge
      await query(`
        INSERT INTO credit_transactions (
          workspace_id, user_id, credits_id, transaction_type, amount,
          previous_balance, new_balance, description, status, created_at
        )
        SELECT 
          $1, NULL, uc.id, 'recharge', $2,
          uc.current_balance - $2, uc.current_balance,
          'Auto-recharge triggered', 'completed', NOW()
        FROM user_credits uc
        WHERE uc.workspace_id = $1 AND uc.is_active = true
      `, [workspace_id, recharge_amount]);

      await query('COMMIT');

      return { success: true, new_balance };
    } catch (error: any) {
      await query('ROLLBACK');
      console.error('Auto-recharge failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Récupérer alertes actives pour un workspace
   */
  async getWorkspaceAlerts(
    workspace_id: string,
    include_resolved: boolean = false
  ): Promise<CreditAlert[]> {
    try {
      const whereClause = include_resolved 
        ? 'WHERE workspace_id = $1'
        : 'WHERE workspace_id = $1 AND is_resolved = false';
      
      const result = await query(`
        SELECT * FROM credit_alerts 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT 50
      `, [workspace_id]);

      return result.rows;
    } catch (error) {
      console.error('Error fetching workspace alerts:', error);
      return [];
    }
  }

  /**
   * Récupérer toutes les alertes actives
   */
  async getAllActiveAlerts(): Promise<CreditAlert[]> {
    try {
      const result = await query(`
        SELECT ca.*, p.project_name 
        FROM credit_alerts ca
        INNER JOIN pype_voice_projects p ON p.id = ca.workspace_id
        WHERE ca.is_resolved = false
        ORDER BY ca.severity DESC, ca.created_at DESC
        LIMIT 100
      `);

      return result.rows;
    } catch (error) {
      console.error('Error fetching all active alerts:', error);
      return [];
    }
  }

  /**
   * Résoudre une alerte
   */
  async resolveAlert(alert_id: string, resolved_by?: string): Promise<boolean> {
    try {
      const result = await query(`
        UPDATE credit_alerts 
        SET is_resolved = true,
            resolved_at = NOW(),
            resolved_by = $2
        WHERE id = $1 AND is_resolved = false
      `, [alert_id, resolved_by]);

      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error resolving alert:', error);
      return false;
    }
  }

  /**
   * Nettoyer anciennes alertes résolues
   */
  async cleanupOldAlerts(days_old: number = 30): Promise<number> {
    try {
      const result = await query(`
        DELETE FROM credit_alerts 
        WHERE is_resolved = true 
        AND resolved_at < NOW() - INTERVAL '${days_old} days'
      `);

      return result.rowCount || 0;
    } catch (error) {
      console.error('Error cleaning up old alerts:', error);
      return 0;
    }
  }
}

// Instance singleton
export const creditMonitor = new CreditMonitor();
