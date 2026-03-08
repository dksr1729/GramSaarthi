import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Container,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Description as ReportIcon,
  LocalOffer as SchemeIcon,
  AutoAwesome as RecommendIcon,
  CloudUpload as IngestIcon,
  AccountCircle as ProfileIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material'
import { useState } from 'react'

const drawerWidth = 240

function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Define menu items based on persona
  const getMenuItems = () => {
    const baseItems = [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
      { text: 'Reports', icon: <ReportIcon />, path: '/reports' },
      { text: 'Budget Insights', icon: <RecommendIcon />, path: '/recommend' },
      { text: 'Profile', icon: <ProfileIcon />, path: '/profile' },
    ]

    if (user?.persona === 'District Admin') {
      return [
        ...baseItems,
        { text: 'Schemes', icon: <SchemeIcon />, path: '/schemes' },
        { text: 'Ingest Data', icon: <IngestIcon />, path: '/ingest' },
      ]
    } else if (user?.persona === 'Panchayat Officer') {
      return [
        ...baseItems,
        { text: 'Schemes', icon: <SchemeIcon />, path: '/schemes' },
      ]
    } else {
      return baseItems
    }
  }

  const menuItems = getMenuItems()

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ color: 'primary.main', fontWeight: 700 }}>
          GramSaarthi
        </Typography>
      </Toolbar>
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path)
                setMobileOpen(false)
              }}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'primary.light',
                  '&:hover': {
                    backgroundColor: 'primary.light',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ color: location.pathname === item.path ? 'primary.main' : 'inherit' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  )

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(145deg, #ecf7ff 0%, #f8f2e8 100%)',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          width: 320,
          height: 320,
          top: -70,
          left: -40,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(244,184,96,0.45) 0%, rgba(244,184,96,0.22) 65%, rgba(244,184,96,0) 100%)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 420,
          height: 420,
          right: -110,
          bottom: -110,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(85,201,186,0.42) 0%, rgba(85,201,186,0.2) 68%, rgba(85,201,186,0) 100%)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          backgroundColor: 'rgba(255,255,255,0.94)',
          color: '#1a2333',
          borderBottom: '1px solid #d9e4dd',
          boxShadow: '0 6px 24px rgba(27, 43, 67, 0.08)',
          backdropFilter: 'blur(8px)',
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography
              variant="h6"
              component="div"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(90deg, #0f766e 0%, #2aa294 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontSize: { xs: '1rem', sm: '1.25rem' },
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user?.village && user?.mandal ? (
                <>
                  {user.village}, {user.mandal}
                </>
              ) : user?.district ? (
                <>
                  {user.district} District
                </>
              ) : (
                'GramSaarthi'
              )}
            </Typography>
            <Typography variant="caption" sx={{ color: '#5f7488' }}>
              {user?.name} • {user?.persona}
            </Typography>
          </Box>

          <Button
            variant="outlined"
            size="small"
            startIcon={<ProfileIcon />}
            onClick={() => navigate('/profile')}
            sx={{
              mr: 1,
              display: { xs: 'none', sm: 'inline-flex' },
              borderColor: '#bfd6cf',
              color: '#0f766e',
            }}
          >
            Profile
          </Button>

          <IconButton color="inherit" onClick={handleLogout}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 }, zIndex: 1 }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          position: 'relative',
          zIndex: 1,
          flexGrow: 1,
          p: { xs: 1.5, sm: 2, md: 3 },
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          backgroundColor: 'transparent',
        }}
      >
        <Toolbar />
        <Container maxWidth="xl" disableGutters>
          <Outlet />
        </Container>
      </Box>
    </Box>
  )
}

export default Layout
