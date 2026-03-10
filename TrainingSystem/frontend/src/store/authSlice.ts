import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { storage } from '@/utils/storage'

interface UserInfo {
  id: string
  username: string
  real_name: string
  roles: string[]
  permissions: string[]
}

interface AuthState {
  token: string | null
  user: UserInfo | null
  isAuthenticated: boolean
}

const initialState: AuthState = {
  token: storage.getToken(),
  user: storage.getUser<UserInfo>(),
  isAuthenticated: !!storage.getToken(),
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ token: string; user: UserInfo }>) {
      state.token = action.payload.token
      state.user = action.payload.user
      state.isAuthenticated = true
      storage.setToken(action.payload.token)
      storage.setUser(action.payload.user)
    },
    logout(state) {
      state.token = null
      state.user = null
      state.isAuthenticated = false
      storage.clear()
    },
  },
})

export const { setCredentials, logout } = authSlice.actions
export default authSlice.reducer
