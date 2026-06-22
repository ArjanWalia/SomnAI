/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BUTTERBASE_URL?: string;
  readonly VITE_BUTTERBASE_APP_ID?: string;
  readonly VITE_BUTTERBASE_TOKEN?: string;
  readonly VITE_BB_USERS_TABLE?: string;
  readonly VITE_BB_SLEEP_TABLE?: string;
  readonly VITE_BB_STRESS_TABLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
