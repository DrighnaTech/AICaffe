import { create } from 'zustand'

// ── Auth Store ──────────────────────────────────────────────────

interface AuthState {
  user: any | null
  token: string | null
  isAuthenticated: boolean
  login: (token: string, user: any) => void
  logout: () => void
  updateUser: (data: Partial<any>) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('aicaffe_token') : null,
  isAuthenticated: false,
  login: (token, user) => {
    localStorage.setItem('aicaffe_token', token)
    set({ token, user, isAuthenticated: true })
  },
  logout: () => {
    localStorage.removeItem('aicaffe_token')
    set({ token: null, user: null, isAuthenticated: false })
  },
  updateUser: (data) => set((state) => ({ user: { ...state.user, ...data } })),
}))

// ── Model Comparison Store ──────────────────────────────────────

interface CompareState {
  selectedModels: string[]
  addModel: (id: string) => void
  removeModel: (id: string) => void
  clearAll: () => void
}

export const useCompareStore = create<CompareState>((set) => ({
  selectedModels: [],
  addModel: (id) => set((state) => {
    if (state.selectedModels.length >= 5) return state
    if (state.selectedModels.includes(id)) return state
    return { selectedModels: [...state.selectedModels, id] }
  }),
  removeModel: (id) => set((state) => ({
    selectedModels: state.selectedModels.filter((m) => m !== id)
  })),
  clearAll: () => set({ selectedModels: [] }),
}))

// ── Chat Store ──────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model?: string
  tokens?: number
  latency?: number
  timestamp: Date
}

interface ChatState {
  conversations: any[]
  activeConversationId: string | null
  messages: Message[]
  isLoading: boolean
  selectedModelId: string | null
  setActiveConversation: (id: string) => void
  addMessage: (msg: Message) => void
  setLoading: (loading: boolean) => void
  setSelectedModel: (id: string) => void
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isLoading: false,
  selectedModelId: null,
  setActiveConversation: (id) => set({ activeConversationId: id }),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  setLoading: (loading) => set({ isLoading: loading }),
  setSelectedModel: (id) => set({ selectedModelId: id }),
}))

// ── Wallet Store ────────────────────────────────────────────────

interface WalletState {
  balance: number
  totalPurchased: number
  totalConsumed: number
  setBalance: (balance: number) => void
  deduct: (amount: number) => void
}

export const useWalletStore = create<WalletState>((set) => ({
  balance: 10000,
  totalPurchased: 10000,
  totalConsumed: 0,
  setBalance: (balance) => set({ balance }),
  deduct: (amount) => set((state) => ({
    balance: state.balance - amount,
    totalConsumed: state.totalConsumed + amount,
  })),
}))
