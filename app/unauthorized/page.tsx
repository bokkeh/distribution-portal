import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-4">
        <div className="text-6xl font-bold text-slate-200">403</div>
        <h1 className="text-2xl font-bold text-slate-900">Access Denied</h1>
        <p className="text-muted-foreground">You don&apos;t have permission to access this page.</p>
        <Link href="/login" className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          Return to Login
        </Link>
      </div>
    </div>
  )
}
