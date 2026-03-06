import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  label?: string
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error)
    return { hasError: true, message }
  }

  reset = () => this.setState({ hasError: false, message: '' })

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="p-3 space-y-1">
          <p className="text-xs text-red-400 font-semibold">
            {this.props.label ? `${this.props.label} failed to render` : 'Render error'}
          </p>
          <p className="text-[10px] text-zinc-500 break-all">{this.state.message}</p>
          <button
            onClick={this.reset}
            className="text-[10px] text-blue-400 hover:text-blue-300 underline"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
