// src/services/s3Manager.ts
import { S3Client, CreateBucketCommand, HeadBucketCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { query } from '@/lib/db';

interface S3Config {
  endpoint: string;
  access_key: string;
  secret_key: string;
  region: string;
  bucket_prefix: string;
  cost_per_gb: number;
}

interface S3UploadResult {
  success: boolean;
  url?: string;
  error?: string;
  size_bytes?: number;
}

interface BucketUsage {
  bucket_name: string;
  object_count: number;
  total_size_bytes: number;
  total_size_gb: number;
  estimated_monthly_cost: number;
}

export class S3Manager {
  private s3Client: S3Client | null = null;
  private config: S3Config | null = null;
  private workspaceId: number | null = null;

  async initialize(workspaceId?: number): Promise<boolean> {
    try {
      this.workspaceId = workspaceId || null;
      
      // Si un workspaceId est fourni, utiliser la config du workspace
      if (workspaceId) {
        const workspaceResult = await query(`
          SELECT s3_enabled, s3_region, s3_endpoint, s3_access_key, s3_secret_key, s3_bucket_prefix, s3_cost_per_gb 
          FROM projects 
          WHERE id = $1 AND s3_enabled = true
        `, [workspaceId]);

        if (workspaceResult.rows && workspaceResult.rows.length > 0) {
          const workspace = workspaceResult.rows[0];
          this.config = {
            endpoint: workspace.s3_endpoint,
            access_key: workspace.s3_access_key,
            secret_key: workspace.s3_secret_key,
            region: workspace.s3_region || 'us-east-1',
            bucket_prefix: workspace.s3_bucket_prefix || 'whispey-',
            cost_per_gb: workspace.s3_cost_per_gb || 0.023
          };
          
          console.log(`✅ Using workspace S3 config for workspace ${workspaceId}`);
        } else {
          console.log(`Workspace ${workspaceId} has no S3 config, falling back to global config`);
        }
      }
      
      // Si pas de config workspace ou pas de workspaceId, utiliser la config globale
      if (!this.config) {
        let result = await query(`
          SELECT value FROM settings_global WHERE key = 's3_config'
        `);

        if (!result.rows || result.rows.length === 0) {
          console.log('S3 configuration not found, creating default configuration...');
          
          // Créer une configuration par défaut
          const defaultConfig: S3Config = {
            endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
            access_key: process.env.S3_ACCESS_KEY || 'minioadmin',
            secret_key: process.env.S3_SECRET_KEY || 'minioadmin',
            region: process.env.S3_REGION || 'us-east-1',
            bucket_prefix: process.env.S3_BUCKET_PREFIX || 'whispey-',
            cost_per_gb: parseFloat(process.env.S3_COST_PER_GB || '0.023')
          };

          // Insérer la configuration par défaut
          try {
            await query(`
              INSERT INTO settings_global (key, value, created_at, updated_at)
              VALUES ('s3_config', $1, NOW(), NOW())
              ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
            `, [JSON.stringify(defaultConfig)]);
            
            this.config = defaultConfig;
            console.log('✅ Created default S3 configuration');
          } catch (insertError) {
            console.warn('Could not save S3 config to database, using temporary config:', insertError);
            this.config = defaultConfig;
          }
        } else {
          this.config = result.rows[0].value as S3Config;
        }
      }

      // Valider la configuration
      if (!this.config.endpoint || !this.config.access_key || !this.config.secret_key) {
        console.error('Incomplete S3 configuration');
        return false;
      }

      // Initialiser le client S3
      this.s3Client = new S3Client({
        endpoint: this.config.endpoint,
        region: this.config.region || 'us-east-1',
        credentials: {
          accessKeyId: this.config.access_key,
          secretAccessKey: this.config.secret_key,
        },
        forcePathStyle: true, // Nécessaire pour Ceph RGW
      });

      console.log('✅ S3Manager initialized successfully');
      return true;

    } catch (error) {
      console.error('Failed to initialize S3Manager:', error);
      return false;
    }
  }

  async createBucketForAgent(agentId: number, projectId: number): Promise<boolean> {
    if (!this.s3Client || !this.config) {
      console.error('S3Manager not initialized');
      return false;
    }

    try {
      const bucketName = this.generateBucketName('agent', agentId, projectId);

      // Vérifier si le bucket existe déjà
      try {
        await this.s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
        console.log(`Bucket ${bucketName} already exists`);
        return true;
      } catch (error: any) {
        if (error.name !== 'NotFound') {
          throw error;
        }
      }

      // Créer le bucket
      await this.s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      
      console.log(`✅ Created S3 bucket: ${bucketName}`);
      return true;

    } catch (error) {
      console.error('Failed to create S3 bucket:', error);
      return false;
    }
  }

  async createBucketForKB(kbId: string, projectId: number): Promise<string | null> {
    if (!this.s3Client || !this.config) {
      console.error('S3Manager not initialized');
      return null;
    }

    try {
      const bucketName = this.generateBucketName('kb', kbId, projectId);

      // Vérifier si le bucket existe déjà
      try {
        await this.s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
        console.log(`Bucket ${bucketName} already exists`);
        return bucketName;
      } catch (error: any) {
        if (error.name !== 'NotFound') {
          throw error;
        }
      }

      // Créer le bucket
      await this.s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      
      console.log(`✅ Created S3 bucket: ${bucketName}`);
      return bucketName;

    } catch (error) {
      console.error('Failed to create S3 bucket:', error);
      return null;
    }
  }

  async uploadKBFile(
    bucketName: string, 
    fileName: string, 
    fileContent: Buffer,
    contentType: string = 'application/pdf'
  ): Promise<S3UploadResult> {
    if (!this.s3Client || !this.config) {
      return {
        success: false,
        error: 'S3Manager not initialized'
      };
    }

    try {
      const key = `kb-files/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${fileName}`;
      
      await this.s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: fileContent,
        ContentType: contentType,
        Metadata: {
          'upload-timestamp': new Date().toISOString(),
          'file-type': 'kb-document'
        }
      }));

      const url = `${this.config.endpoint}/${bucketName}/${key}`;

      return {
        success: true,
        url,
        size_bytes: fileContent.length
      };

    } catch (error) {
      console.error('Failed to upload KB file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  async uploadAudioFile(
    bucketName: string, 
    fileName: string, 
    fileContent: Buffer,
    contentType: string = 'audio/wav'
  ): Promise<S3UploadResult> {
    if (!this.s3Client || !this.config) {
      return {
        success: false,
        error: 'S3Manager not initialized'
      };
    }

    try {
      const key = `calls/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${fileName}`;
      
      await this.s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: fileContent,
        ContentType: contentType,
        Metadata: {
          'upload-timestamp': new Date().toISOString(),
          'file-type': 'audio-call'
        }
      }));

      const url = `${this.config.endpoint}/${bucketName}/${key}`;

      return {
        success: true,
        url,
        size_bytes: fileContent.length
      };

    } catch (error) {
      console.error('Failed to upload audio file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  async getBucketUsage(bucketName: string): Promise<BucketUsage | null> {
    if (!this.s3Client || !this.config) {
      console.error('S3Manager not initialized');
      return null;
    }

    try {
      const command = new ListObjectsV2Command({ Bucket: bucketName });
      const response = await this.s3Client.send(command);
      
      let totalSize = 0;
      let objectCount = 0;

      if (response.Contents) {
        for (const object of response.Contents) {
          totalSize += object.Size || 0;
          objectCount++;
        }
      }

      const totalSizeGB = totalSize / (1024 * 1024 * 1024);
      const estimatedMonthlyCost = totalSizeGB * this.config.cost_per_gb;

      return {
        bucket_name: bucketName,
        object_count: objectCount,
        total_size_bytes: totalSize,
        total_size_gb: totalSizeGB,
        estimated_monthly_cost: estimatedMonthlyCost
      };

    } catch (error) {
      console.error('Failed to get bucket usage:', error);
      return null;
    }
  }

  async deleteOldFiles(bucketName: string, olderThanDays: number = 90): Promise<number> {
    if (!this.s3Client) {
      console.error('S3Manager not initialized');
      return 0;
    }

    try {
      const command = new ListObjectsV2Command({ Bucket: bucketName });
      const response = await this.s3Client.send(command);
      
      if (!response.Contents) {
        return 0;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      let deletedCount = 0;

      for (const object of response.Contents) {
        if (object.LastModified && object.LastModified < cutoffDate) {
          await this.s3Client.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: object.Key!
          }));
          deletedCount++;
        }
      }

      console.log(`🗑️ Deleted ${deletedCount} old files from ${bucketName}`);
      return deletedCount;

    } catch (error) {
      console.error('Failed to delete old files:', error);
      return 0;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.s3Client) {
      return false;
    }

    try {
      // Test simple avec une opération ListBuckets ou similaire
      // Pour Ceph RGW, on peut tester avec un bucket de test
      const testBucket = `${this.config?.bucket_prefix || 'whispey-'}test-connection`;
      
      try {
        await this.s3Client.send(new HeadBucketCommand({ Bucket: testBucket }));
      } catch (error: any) {
        // Si le bucket n'existe pas, c'est OK, ça veut dire que la connexion fonctionne
        if (error.name === 'NotFound') {
          return true;
        }
        throw error;
      }

      return true;

    } catch (error) {
      console.error('S3 connection test failed:', error);
      return false;
    }
  }

  private generateBucketName(type: 'agent' | 'kb', serviceId: string | number, projectId: number): string {
    const prefix = this.config?.bucket_prefix || 'whispey-';
    return `${prefix}${type}-${serviceId}-${projectId}`.toLowerCase();
  }

  // Méthode utilitaire pour calculer le coût de stockage
  static calculateStorageCost(sizeGB: number, costPerGB: number): number {
    return sizeGB * costPerGB;
  }

  // Méthode pour migrer les buckets lors d'un changement de configuration
  async migrateBucketsForWorkspace(
    workspaceId: number,
    oldConfig: S3Config,
    newConfig: S3Config
  ): Promise<{ success: boolean; migratedAgents: number; migratedKBs: number; errors: string[] }> {
    const errors: string[] = [];
    let migratedAgents = 0;
    let migratedKBs = 0;

    try {
      // Vérifier si la configuration a vraiment changé
      const configChanged = (
        oldConfig.bucket_prefix !== newConfig.bucket_prefix ||
        oldConfig.region !== newConfig.region ||
        oldConfig.endpoint !== newConfig.endpoint
      );

      if (!configChanged) {
        return { success: true, migratedAgents: 0, migratedKBs: 0, errors: [] };
      }

      // Migrer les buckets des agents
      const agentsResult = await query(`
        SELECT id, s3_bucket_name 
        FROM pype_voice_agents 
        WHERE project_id = $1 AND s3_bucket_name IS NOT NULL
      `, [workspaceId]);

      for (const agent of agentsResult.rows || []) {
        const oldBucketName = agent.s3_bucket_name;
        const newBucketName = this.generateBucketNameWithConfig(newConfig, 'agent', agent.id, workspaceId);

        if (oldBucketName !== newBucketName) {
          const migrationResult = await this.migrateBucket(
            oldBucketName, 
            newBucketName, 
            oldConfig.endpoint, 
            newConfig.endpoint
          );
          if (migrationResult.success) {
            // Mettre à jour la référence en DB
            await query(`
              UPDATE pype_voice_agents 
              SET s3_bucket_name = $1 
              WHERE id = $2
            `, [newBucketName, agent.id]);
            migratedAgents++;
          } else {
            errors.push(`Agent ${agent.id}: ${migrationResult.error}`);
          }
        }
      }

      // Migrer les buckets des KB
      const kbsResult = await query(`
        SELECT id, s3_bucket_name 
        FROM pype_voice_knowledge_bases 
        WHERE workspace_id = $1 AND s3_bucket_name IS NOT NULL
      `, [workspaceId]);

      for (const kb of kbsResult.rows || []) {
        const oldBucketName = kb.s3_bucket_name;
        const newBucketName = this.generateBucketNameWithConfig(newConfig, 'kb', kb.id, workspaceId);

        if (oldBucketName !== newBucketName) {
          const migrationResult = await this.migrateBucket(
            oldBucketName, 
            newBucketName, 
            oldConfig.endpoint, 
            newConfig.endpoint
          );
          if (migrationResult.success) {
            // Mettre à jour la référence en DB
            await query(`
              UPDATE pype_voice_knowledge_bases 
              SET s3_bucket_name = $1 
              WHERE id = $2
            `, [newBucketName, kb.id]);
            migratedKBs++;
          } else {
            errors.push(`KB ${kb.id}: ${migrationResult.error}`);
          }
        }
      }

      return {
        success: errors.length === 0,
        migratedAgents,
        migratedKBs,
        errors
      };

    } catch (error) {
      console.error('Failed to migrate buckets for workspace:', error);
      return {
        success: false,
        migratedAgents,
        migratedKBs,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  // Méthode pour migrer un bucket individuel
  private async migrateBucket(
    oldBucketName: string, 
    newBucketName: string, 
    oldEndpoint: string, 
    newEndpoint: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.s3Client) {
      return { success: false, error: 'S3Manager not initialized' };
    }

    try {
      // Vérifier si l'ancien bucket existe
      let oldBucketExists = false;
      try {
        await this.s3Client.send(new HeadBucketCommand({ Bucket: oldBucketName }));
        oldBucketExists = true;
      } catch (error: any) {
        if (error.name !== 'NotFound') {
          throw error;
        }
      }

      // Vérifier si le nouveau bucket existe déjà
      let newBucketExists = false;
      try {
        await this.s3Client.send(new HeadBucketCommand({ Bucket: newBucketName }));
        newBucketExists = true;
      } catch (error: any) {
        if (error.name !== 'NotFound') {
          throw error;
        }
      }

      if (oldBucketExists && !newBucketExists) {
        // Vérifier si c'est le même endpoint
        const sameEndpoint = oldEndpoint === newEndpoint;
        
        if (sameEndpoint) {
          // Cas 1a: Même endpoint -> Renommer le bucket (copier tous les objets vers nouveau nom)
          await this.s3Client.send(new CreateBucketCommand({ Bucket: newBucketName }));
          
          // Copier tous les objets de l'ancien vers le nouveau bucket
          const copyResult = await this.copyAllObjectsBetweenBuckets(oldBucketName, newBucketName);
          
          if (copyResult.success) {
            console.log(`✅ Renamed bucket: ${oldBucketName} -> ${newBucketName} (${copyResult.objectsCopied} objects)`);
            // Note: En production, supprimer l'ancien bucket après vérification
            // await this.deleteAllObjectsAndBucket(oldBucketName);
          } else {
            console.warn(`⚠️ Partial bucket rename: ${copyResult.error}`);
          }
        } else {
          // Cas 1b: Endpoint différent -> Créer nouveau bucket seulement
          await this.s3Client.send(new CreateBucketCommand({ Bucket: newBucketName }));
          console.log(`✅ Created new bucket: ${newBucketName} (different endpoint, migration from ${oldBucketName})`);
          console.warn(`⚠️ Manual data migration needed from ${oldEndpoint} to ${newEndpoint}`);
        }
      } else if (!oldBucketExists && !newBucketExists) {
        // Cas 2: Aucun bucket n'existe -> Créer le nouveau
        await this.s3Client.send(new CreateBucketCommand({ Bucket: newBucketName }));
        console.log(`✅ Created new bucket: ${newBucketName} (no old bucket found)`);
      } else if (newBucketExists) {
        // Cas 3: Le nouveau bucket existe déjà -> OK
        console.log(`ℹ️ New bucket ${newBucketName} already exists`);
      }

      return { success: true };

    } catch (error) {
      console.error(`Failed to migrate bucket ${oldBucketName} -> ${newBucketName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Migration failed'
      };
    }
  }

  // Méthode pour copier tous les objets entre buckets (même endpoint)
  private async copyAllObjectsBetweenBuckets(
    sourceBucket: string, 
    targetBucket: string
  ): Promise<{ success: boolean; objectsCopied: number; error?: string }> {
    if (!this.s3Client) {
      return { success: false, objectsCopied: 0, error: 'S3Manager not initialized' };
    }

    try {
      // Lister tous les objets du bucket source
      const listCommand = new ListObjectsV2Command({ Bucket: sourceBucket });
      const listResponse = await this.s3Client.send(listCommand);
      
      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        return { success: true, objectsCopied: 0 };
      }

      let copiedCount = 0;
      const { CopyObjectCommand, GetObjectCommand, PutObjectCommand } = await import('@aws-sdk/client-s3');

      // Copier chaque objet
      for (const object of listResponse.Contents) {
        if (!object.Key) continue;

        try {
          // Pour S3 compatible, utiliser Get + Put au lieu de Copy
          const getCommand = new GetObjectCommand({
            Bucket: sourceBucket,
            Key: object.Key
          });
          
          const getResponse = await this.s3Client.send(getCommand);
          const body = await this.streamToBuffer(getResponse.Body);

          const putCommand = new PutObjectCommand({
            Bucket: targetBucket,
            Key: object.Key,
            Body: body,
            ContentType: getResponse.ContentType,
            Metadata: getResponse.Metadata
          });

          await this.s3Client.send(putCommand);
          copiedCount++;

        } catch (copyError) {
          console.warn(`Failed to copy object ${object.Key}:`, copyError);
          // Continue avec les autres objets
        }
      }

      return { 
        success: copiedCount === listResponse.Contents.length, 
        objectsCopied: copiedCount,
        error: copiedCount < listResponse.Contents.length ? 'Some objects failed to copy' : undefined
      };

    } catch (error) {
      console.error('Failed to copy objects between buckets:', error);
      return {
        success: false,
        objectsCopied: 0,
        error: error instanceof Error ? error.message : 'Copy failed'
      };
    }
  }

  // Utilitaire pour convertir stream en buffer
  private async streamToBuffer(stream: any): Promise<Buffer> {
    if (Buffer.isBuffer(stream)) {
      return stream;
    }
    
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  // Méthode utilitaire pour générer un nom de bucket avec une config spécifique
  private generateBucketNameWithConfig(config: S3Config, type: 'agent' | 'kb', serviceId: string | number, projectId: number): string {
    const prefix = config.bucket_prefix || 'whispey-';
    return `${prefix}${type}-${serviceId}-${projectId}`.toLowerCase();
  }

  // Méthode pour obtenir les statistiques globales de tous les buckets (agents + KB)
  async getGlobalStorageStats(): Promise<{
    total_agents: number;
    total_kbs: number;
    total_buckets: number;
    total_size_gb: number;
    total_monthly_cost: number;
    agents_usage: BucketUsage[];
    kbs_usage: BucketUsage[];
  } | null> {
    try {
      // Récupérer tous les agents avec leurs buckets
      const agentsResult = await query(`
        SELECT id, name, s3_bucket_name, project_id 
        FROM pype_voice_agents 
        WHERE s3_bucket_name IS NOT NULL
      `);

      // Récupérer toutes les KB avec leurs buckets
      const kbsResult = await query(`
        SELECT id, name, s3_bucket_name, workspace_id 
        FROM pype_voice_knowledge_bases 
        WHERE s3_bucket_name IS NOT NULL
      `);

      const agentsUsage: BucketUsage[] = [];
      const kbsUsage: BucketUsage[] = [];
      let totalSizeGB = 0;
      let totalMonthlyCost = 0;

      // Traiter les buckets des agents
      for (const agent of agentsResult.rows || []) {
        const usage = await this.getBucketUsage(agent.s3_bucket_name);
        if (usage) {
          agentsUsage.push(usage);
          totalSizeGB += usage.total_size_gb;
          totalMonthlyCost += usage.estimated_monthly_cost;
        }
      }

      // Traiter les buckets des KB
      for (const kb of kbsResult.rows || []) {
        const usage = await this.getBucketUsage(kb.s3_bucket_name);
        if (usage) {
          kbsUsage.push(usage);
          totalSizeGB += usage.total_size_gb;
          totalMonthlyCost += usage.estimated_monthly_cost;
        }
      }

      return {
        total_agents: agentsResult.rows?.length || 0,
        total_kbs: kbsResult.rows?.length || 0,
        total_buckets: agentsUsage.length + kbsUsage.length,
        total_size_gb: totalSizeGB,
        total_monthly_cost: totalMonthlyCost,
        agents_usage: agentsUsage,
        kbs_usage: kbsUsage
      };

    } catch (error) {
      console.error('Failed to get global storage stats:', error);
      return null;
    }
  }
}

// Instance singleton
export const s3Manager = new S3Manager();
