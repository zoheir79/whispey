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

  async initialize(): Promise<boolean> {
    try {
      // Récupérer la configuration S3 depuis la base de données
      const result = await query(`
        SELECT value FROM settings_global WHERE key = 's3_config'
      `);

      if (!result.rows || result.rows.length === 0) {
        console.error('S3 configuration not found in database');
        return false;
      }

      this.config = result.rows[0].value as S3Config;

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

  async createBucketForKB(kbId: string, projectId: number): Promise<boolean> {
    if (!this.s3Client || !this.config) {
      console.error('S3Manager not initialized');
      return false;
    }

    try {
      const bucketName = this.generateBucketName('kb', kbId, projectId);

      // Vérifier si le bucket existe déjà
      try {
        await this.s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
        console.log(`KB Bucket ${bucketName} already exists`);
        return true;
      } catch (error: any) {
        if (error.name !== 'NotFound') {
          throw error;
        }
      }

      // Créer le bucket
      await this.s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      
      console.log(`✅ Created S3 bucket for KB: ${bucketName}`);
      return true;

    } catch (error) {
      console.error('Failed to create S3 bucket for KB:', error);
      return false;
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
