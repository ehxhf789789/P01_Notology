/**
 * «개인 GitHub» 창의 서버 손 (v61 B5 K3 · 2026-09-25)
 *
 * 한빈 09-25: *"Github 웹의 기능을 참조하여, 개인 Github 를 notology 에 하위 기능으로"*.
 * 모든 부름은 `/api/invoke` 의 code_* 명령 — 서버는 git 을 직접 부르지 않고 허브(dobbin-codehub)의
 * 유닉스 소켓에 묻는다 (git 은 허브의 자원 칸 안에서).
 *
 * 🔴 파일 주소는 **커밋 sha** 로 적는다 — `code:<slug>@<ref>/<경로>` 는 첫 `/` 에서 ref 를 끊으므로
 *    «기능/가설재» 같은 가지 이름이 경로로 샌다. sha 에는 `/` 가 없다.
 */
import { invoke } from '../../web/core';

export interface CloneState {
  host: string; path: string; branch: string | null; head: string | null;
  dirty: number | null; ahead: number | null; behind: number | null;
  paused: boolean; report_at: string | null;
}
export interface ProjectLink { id: number; label: string; role: string; decided_by?: string | null }
export interface RepoSummary {
  slug: string; name: string; kind: string; github_role: string; github: boolean;
  publish_enabled: boolean; version: number; status: string;
  last: { host: string; at: string; kind: string } | null;
  clones: CloneState[]; projects: ProjectLink[]; conflicts: number;
  branch: string; sha: string; description: string;
}
export interface RefRow { ref: string; sha: string; at: number; subject: string; name?: string; host?: string; branch?: string }
export interface Divergence {
  id: number; branch: string; host: string; state: string; conflicts: string[];
  hub_sha: string | null; host_sha: string | null; merge_sha: string | null; at: string; resolved_at: string | null;
}
export interface PublishRow {
  branch: string; state: string; why: string | null; sha: string | null;
  included: number; excluded: number; secrets: number; at: string;
}
export interface PublishRules { enabled?: boolean; branch?: string; exclude?: string[]; size_cap_mb?: number }
export interface RepoDetail {
  slug: string; name: string; kind: string; github_role: string; github_url: string | null;
  publish_rules: PublishRules; version: number; status: string; created_by: string | null;
  created_at: string | null; default_branch: string; sha: string; description: string;
  readme: { name: string; text: string } | null;
  branches: RefRow[]; tags: RefRow[]; parks: RefRow[]; wips: RefRow[];
  clones: CloneState[]; divergences: Divergence[]; publishes: PublishRow[]; projects: ProjectLink[];
}
export interface TreeEntry {
  name: string; type: 'blob' | 'tree' | 'commit'; mode: string; sha: string; size: number | null;
  last: { sha: string; at: number; subject: string } | null;
}
export interface TreeResult { slug: string; ref: string; sha: string; path: string; entries: TreeEntry[]; readme: string | null }
export interface BlobResult { slug: string; sha: string; path: string; size: number; binary: boolean; text: string | null; too_big: boolean }
export interface CommitRow {
  sha: string; parents: string[]; author: string; email: string; at: number; subject: string;
  pushed: { host: string; via: string } | null;
}
export interface LogResult { slug: string; sha: string; path: string; commits: CommitRow[]; more: boolean }
export interface Patch { header: string; path: string; patch: string; truncated: boolean }
export interface CommitResult {
  slug: string; commit: CommitRow & { body: string };
  files: { path: string; from?: string; add: string; del: string }[];
  patches: Patch[]; truncated: boolean;
}
export interface CompareResult { a: string; b: string; base: string; ahead: number; behind: number; patches: Patch[]; truncated: boolean }
export interface ActivityItem {
  at: string; kind: string; host?: string; ref?: string; sha?: string; subject?: string | null;
  files?: string[]; detail?: Record<string, unknown>; why?: string | null; count?: number; new_ref?: boolean;
}
export interface ActivityResult { slug: string; days: { date: string; items: ActivityItem[] }[] }
export interface Candidate {
  host: string; path: string; git: boolean; kind: string | null; decision: string | null; decided_by: string | null;
  remotes: string[]; last_commit_at: string | null; dirty: number | null; claude_folder: string | null;
  slug: string | null; why: string | null;
}
export interface Project { id: number; label: string; tag: string; kind: string }
export interface PublishResult {
  ok: boolean; state: string; why: string | null; hub: string | null; published: string | null;
  github_before: string | null; included: string[]; excluded: { path: string; why: string }[];
  secrets: { path: string; rule: string }[];
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const r = await invoke<T>(cmd, args);
  if (r == null) throw new Error('이 서버는 아직 «개인 GitHub» 를 모릅니다');
  return r;
}

export const code = {
  repos: () => call<{ repos: RepoSummary[] }>('code_repos'),
  repo: (slug: string) => call<RepoDetail>('code_repo', { slug }),
  tree: (slug: string, ref: string, path: string) => call<TreeResult>('code_tree', { slug, ref, path }),
  blob: (slug: string, ref: string, path: string) => call<BlobResult>('code_blob', { slug, ref, path }),
  log: (slug: string, ref: string, path: string, skip = 0) =>
    call<LogResult>('code_log', { slug, ref, path, n: 50, skip }),
  commit: (slug: string, sha: string) => call<CommitResult>('code_commit', { slug, sha }),
  compare: (slug: string, a: string, b: string) => call<CompareResult>('code_compare', { slug, a, b }),
  activity: (slug: string, days = 30) => call<ActivityResult>('code_activity', { slug, days }),
  candidates: (host = '') => call<{ candidates: Candidate[] }>('code_candidates', { host }),
  projects: () => call<{ projects: Project[] }>('code_projects'),
  create: (name: string, project_id?: number | null) =>
    call<{ slug: string; created: boolean }>('code_create', { name, project_id: project_id ?? null }),
  linkProject: (slug: string, project_id: number, role = 'main', remove = false) =>
    call<Record<string, unknown>>('code_link_project', { slug, project_id, role, remove }),
  cloneOn: (slug: string, host: string, dest?: string) =>
    call<{ job: number; queued: boolean }>('code_clone_on', { slug, host, dest: dest || null }),
  publishRules: (slug: string, rules: PublishRules) =>
    call<{ publish_rules: PublishRules }>('code_publish_rules', { slug, ...rules }),
  publishPreview: (slug: string) => call<PublishResult>('code_publish_preview', { slug }),
  publishNow: (slug: string) => call<PublishResult>('code_publish', { slug }),
  resolve: (divergence: number, choices: Record<string, 'hub' | 'park' | 'both'>) =>
    call<{ state: string; sha: string }>('code_resolve', { divergence, choices }),
};

/** 그림·PDF 미리보기·내려받기 주소 — 🔴 ref 가 아니라 **sha** 로 (가지 이름의 `/` 가 경로로 새지 않게) */
export function codeFileUrl(slug: string, sha: string, path: string, download = false): string {
  return `/api/file?path=${encodeURIComponent(`code:${slug}@${sha}/${path}`)}${download ? '&download=1' : ''}`;
}

/** «3시간 전» · «2일 전 (09-23 14:10)» — 보는 사람의 때로 */
export function ago(at: string | number | null | undefined): string {
  if (at == null || at === '') return '—';
  const t = typeof at === 'number' ? at * 1000 : Date.parse(at);
  if (!Number.isFinite(t)) return String(at);
  const d = (Date.now() - t) / 1000;
  if (d < 60) return '방금';
  if (d < 3600) return `${Math.floor(d / 60)}분 전`;
  if (d < 86400) return `${Math.floor(d / 3600)}시간 전`;
  const dt = new Date(t);
  const md = `${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  return `${Math.floor(d / 86400)}일 전 (${md})`;
}

export function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
