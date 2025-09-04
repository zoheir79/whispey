import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import { useChartContext } from './EnhancedChartBuilder'

interface ChartBuilderDialogProps {
  metadataFields: string[]
  transcriptionFields: string[]
}

export const ChartBuilderDialog: React.FC<ChartBuilderDialogProps> = ({ 
  metadataFields, 
  transcriptionFields 
}) => {
  const { newChart, setNewChart, addChart } = useChartContext()
  
  const fields = {
    metadata: metadataFields,
    transcription_metrics: transcriptionFields
  }

  // Predefined table fields for quick access
  const tableFields = [
    'call_ended_reason',
    'transcript_type',
    'environment'
  ]

  const handleAddChart = () => {
    addChart()
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          Add Chart
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-md bg-white dark:bg-slate-800 dark:border-slate-700 text-gray-900 dark:text-gray-100">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-100">Add Count Chart</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Source Selection */}
          <div>
            <Label className="text-gray-700 dark:text-gray-300">Data Source</Label>
            <Select
              value={newChart.source}
              onValueChange={(value) => setNewChart(prev => ({ 
                ...prev, 
                source: value as 'table' | 'metadata' | 'transcription_metrics', 
                field: undefined 
              }))}
            >
              <SelectTrigger className="bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100">
                <SelectValue placeholder="Select data source" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
                <SelectItem value="table" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700">Table Fields ({tableFields.length})</SelectItem>
                <SelectItem value="metadata" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700">Metadata ({fields.metadata.length} fields)</SelectItem>
                <SelectItem value="transcription_metrics" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700">Transcription ({fields.transcription_metrics.length} fields)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Field Selection */}
          {newChart.source && (
            <div>
              <Label className="text-gray-700 dark:text-gray-300">Field</Label>
              <Select
                value={newChart.field}
                onValueChange={(value) => setNewChart(prev => ({ ...prev, field: value }))}
              >
                <SelectTrigger className="bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
                  {(newChart.source === 'table' ? tableFields : fields[newChart.source as keyof typeof fields]).map(field => (
                    <SelectItem key={field} value={field} className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700">
                      {field}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Filter Value */}
          <div>
            <Label className="text-gray-700 dark:text-gray-300">Filter Value (Optional)</Label>
            <Input
              placeholder="e.g., 'Yes', 'completed', 'Successful'"
              value={newChart.filterValue || ''}
              onChange={(e) => setNewChart(prev => ({ ...prev, filterValue: e.target.value }))}
              className="bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Leave empty to show multiple lines for all values
            </p>
          </div>

          {/* Chart Type */}
          <div>
            <Label className="text-gray-700 dark:text-gray-300">Chart Type</Label>
            <Select
              value={newChart.chartType}
              onValueChange={(value) => setNewChart(prev => ({ 
                ...prev, 
                chartType: value as 'line' | 'bar' 
              }))}
            >
              <SelectTrigger className="bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
                <SelectItem value="line" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700">Line Chart</SelectItem>
                <SelectItem value="bar" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700">Bar Chart (Stacked)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              onClick={handleAddChart}
              disabled={!newChart.field || !newChart.source}
              className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Add Chart
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}