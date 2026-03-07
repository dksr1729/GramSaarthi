import { useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  MenuItem,
  TextField,
  Grid,
  Divider,
  Chip,
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  CheckCircle as SuccessIcon,
  Storage as StorageIcon,
} from '@mui/icons-material'

const targetIndexes = [
  { value: 'schemes_index', label: 'schemes_index — Official Guidelines' },
  { value: 'citizen_faq_index', label: 'citizen_faq_index — Citizen FAQs' },
]

const documentTypes = [
  { value: 'official_guidelines', label: 'Official Guidelines' },
  { value: 'citizen_faq', label: 'Citizen FAQ' },
  { value: 'citizen_guide', label: 'Citizen Guide' },
  { value: 'ministry_circular', label: 'Ministry Circular' },
  { value: 'state_implementation', label: 'State Implementation' },
]

const schemeTypes = [
  'Health',
  'Agriculture',
  'Housing',
  'Education',
  'Energy / LPG',
  'Employment',
  'Social Welfare',
  'Financial Inclusion',
]

const stateScopes = [
  'Central',
  'Andhra Pradesh',
  'Delhi',
  'Gujarat',
  'Karnataka',
  'Kerala',
  'Maharashtra',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'West Bengal',
]

function Ingest() {
  const { user } = useAuthStore()
  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [lastUpload, setLastUpload] = useState(null)

  const [formData, setFormData] = useState({
    target_index: 'schemes_index',
    document_type: 'official_guidelines',
    scheme_name: '',
    scheme_type: 'Health',
    ministry: '',
    state_scope: 'Central',
  })

  if (user?.persona !== 'District Admin') {
    return (
      <Box>
        <Alert severity="error">Access denied. Only District Admins can access this page.</Alert>
      </Box>
    )
  }

  const handleSelectFile = (event) => {
    const file = event.target.files[0]
    if (!file) {
      return
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setMessage({ type: 'error', text: 'Only PDF files are supported.' })
      return
    }

    setSelectedFile(file)
    setMessage({ type: '', text: '' })
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage({ type: 'error', text: 'Please select a PDF file first.' })
      return
    }

    setUploading(true)
    setMessage({ type: '', text: '' })

    try {
      const payload = new FormData()
      payload.append('file', selectedFile)
      payload.append('target_index', formData.target_index)
      payload.append('document_type', formData.document_type)
      payload.append('scheme_name', formData.scheme_name)
      payload.append('scheme_type', formData.scheme_type)
      payload.append('ministry', formData.ministry)
      payload.append('state_scope', formData.state_scope)

      const response = await api.post('/api/ingest', payload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      setLastUpload(response.data)
      setMessage({ type: 'success', text: response.data.message || 'Ingestion completed successfully.' })
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to ingest file. Please try again.',
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 0.5 }}>
        Document Ingestion
      </Typography>
      <Typography variant="body2" sx={{ color: '#5f7488', mb: 3 }}>
        Ingests documents into local ChromaDB collections.
      </Typography>

      <Paper sx={{ p: 3, border: '1px solid #c7dcd7', borderRadius: 2, boxShadow: '0 10px 30px rgba(27,43,67,0.08)' }}>
        {message.text && (
          <Alert severity={message.type} sx={{ mb: 2 }}>
            {message.text}
          </Alert>
        )}

        <Box
          onClick={() => fileInputRef.current?.click()}
          sx={{
            border: '2px dashed #c7dcd7',
            borderRadius: 2,
            py: 4,
            px: 2,
            textAlign: 'center',
            cursor: 'pointer',
            mb: 2,
            '&:hover': { borderColor: '#0f766e', backgroundColor: '#f4fbf9' },
          }}
        >
          <Typography variant="h5" sx={{ color: '#0f766e', mb: 1 }}>⊕</Typography>
          <Typography variant="body2" sx={{ color: '#46566c' }}>
            {selectedFile ? selectedFile.name : 'Drop PDF here or click to browse'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#5f7488' }}>
            Supports: PDF files only
          </Typography>
          <input ref={fileInputRef} type="file" accept=".pdf" hidden onChange={handleSelectFile} />
        </Box>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              select
              label="Target Index"
              value={formData.target_index}
              onChange={(e) => setFormData((prev) => ({ ...prev, target_index: e.target.value }))}
            >
              {targetIndexes.map((item) => (
                <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              select
              label="Document Type"
              value={formData.document_type}
              onChange={(e) => setFormData((prev) => ({ ...prev, document_type: e.target.value }))}
            >
              {documentTypes.map((item) => (
                <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />
        <Typography variant="overline" sx={{ letterSpacing: '0.15em', color: '#46566c', fontWeight: 700 }}>
          Metadata / Filters
        </Typography>

        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Scheme Name"
              placeholder="e.g. Ayushman Bharat PM-JAY"
              value={formData.scheme_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, scheme_name: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              select
              label="Scheme Type"
              value={formData.scheme_type}
              onChange={(e) => setFormData((prev) => ({ ...prev, scheme_type: e.target.value }))}
            >
              {schemeTypes.map((item) => (
                <MenuItem key={item} value={item}>{item}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Ministry"
              placeholder="e.g. Ministry of Health and Family Welfare"
              value={formData.ministry}
              onChange={(e) => setFormData((prev) => ({ ...prev, ministry: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              select
              label="State / Scope"
              value={formData.state_scope}
              onChange={(e) => setFormData((prev) => ({ ...prev, state_scope: e.target.value }))}
            >
              {stateScopes.map((item) => (
                <MenuItem key={item} value={item}>{item}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>

        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          startIcon={uploading ? <CircularProgress size={18} /> : <UploadIcon />}
          sx={{ mt: 3, fontWeight: 700, letterSpacing: '0.08em', px: 3, py: 1.25 }}
        >
          {uploading ? 'Ingesting...' : 'Ingest Document'}
        </Button>
      </Paper>

      {lastUpload && (
        <Paper sx={{ mt: 2, p: 2.5, border: '1px solid #c7dcd7', borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Last Ingestion</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Chip icon={<SuccessIcon />} label={`Status: ${lastUpload.status}`} color="success" variant="outlined" />
            <Chip icon={<StorageIcon />} label={`Index: ${lastUpload.target_index}`} variant="outlined" />
            <Chip label={`Chunks: ${lastUpload.chunks_ingested}`} variant="outlined" />
            <Chip label={`Index Count: ${lastUpload.index_count}`} variant="outlined" />
          </Box>
          <Typography variant="body2" sx={{ color: '#5f7488', mt: 1 }}>
            File: {lastUpload.filename}
          </Typography>
        </Paper>
      )}
    </Box>
  )
}

export default Ingest
