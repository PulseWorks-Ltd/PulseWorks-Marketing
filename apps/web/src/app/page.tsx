export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-4">
          PulseWorks Marketing
        </h1>
        <p className="text-center text-muted-foreground mb-8">
          AI-powered social media content generation and scheduling
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12">
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold mb-2">Get Started</h2>
            <p className="text-muted-foreground mb-4">
              Sign up to start generating content for your business
            </p>
            <a
              href="/auth/signup"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Sign Up
            </a>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold mb-2">Already Have an Account?</h2>
            <p className="text-muted-foreground mb-4">
              Sign in to access your dashboard
            </p>
            <a
              href="/auth/signin"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Sign In
            </a>
          </div>
        </div>

        <div className="mt-16 text-center text-sm text-muted-foreground">
          <p>Built with ❤️ in New Zealand</p>
        </div>
      </div>
    </main>
  );
}
