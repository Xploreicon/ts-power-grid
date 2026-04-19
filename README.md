# T&S Power Grid

Peer-to-peer power-sharing platform for Nigeria.

## Setup

1.  **Clone the repository**:
    ```bash
    git clone [repository-url]
    cd ts-power-grid
    ```

2.  **Install dependencies**:
    ```bash
    pnpm install
    ```

3.  **Environment Variables**:
    Copy `.env.example` to `.env.local` and fill in the required keys.
    ```bash
    cp .env.example .env.local
    ```

4.  **Run the development server**:
    ```bash
    pnpm dev
    ```

## Project Structure

- `app/`: Next.js App Router (Marketing, Auth, Host, Admin, API)
- `components/`: UI and specific featured components
- `lib/`: Utilities, Supabase client, hooks, and types
- `public/`: Assets and PWA manifest

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database/Auth**: Supabase
- **Icons**: Lucide React
- **Validation**: Zod
- **Notifications**: Sonner
- **Charts**: Recharts
