/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BUTTERBASE_URL?: string;
  readonly VITE_BUTTERBASE_ANON_KEY?: string;
  readonly VITE_BB_USERS_TABLE?: string;
  readonly VITE_BB_SLEEP_TABLE?: string;
  readonly VITE_BB_STRESS_TABLE?: string;
  readonly VITE_BB_VIDEO_BUCKET?: string;
  readonly VITE_BB_AUDIO_BUCKET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
