import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Loader2, Pencil, Trash2, CornerDownRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OwnerAvatar } from '@/components/OwnerInput';
import { MentionTextarea } from './MentionTextarea';
import { MentionText } from './MentionText';
import { commentsApi, Comment } from '@/lib/api/comments';
import { queryKeys } from '@/lib/queryKeys';
import { useOrgUsers } from '@/hooks/useOrgUsers';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { formatRelativeTime } from '@/types/activity';
import { toast } from 'sonner';

/** 목표 댓글 스레드(업데이트). Note(고정 메모)와 별개 — 저자 서명 + @멘션 대화. */
export function CommentThread({ goalId }: { goalId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrganization } = useWorkspace();
  const { data: users = [] } = useOrgUsers();
  const isAdmin = currentOrganization?.role === 'OWNER' || currentOrganization?.role === 'ADMIN';

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const { data: comments = [], isLoading } = useQuery({
    queryKey: queryKeys.comments(goalId),
    queryFn: () => commentsApi.list(goalId),
    enabled: !!goalId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.comments(goalId) });

  const createM = useMutation({
    mutationFn: ({ body, parentId }: { body: string; parentId?: string }) => commentsApi.create(goalId, body, parentId),
    onSuccess: () => { invalidate(); setDraft(''); setReplyDraft(''); setReplyTo(null); },
    onError: (e) => toast.error(e instanceof Error ? e.message : '작성 실패'),
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => commentsApi.update(goalId, id, body),
    onSuccess: () => { invalidate(); setEditing(null); },
    onError: (e) => toast.error(e instanceof Error ? e.message : '수정 실패'),
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => commentsApi.remove(goalId, id),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : '삭제 실패'),
  });

  const canModify = (c: Comment) => c.authorId === user?.userId;

  const renderComment = (c: Comment, isReply = false) => (
    <div key={c.id} className={isReply ? 'ml-8 mt-2' : 'mt-3'}>
      <div className="flex gap-2">
        <OwnerAvatar ownerName={c.authorName} registeredUsers={users} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium">{c.authorName}</span>
            <span className="text-muted-foreground">{formatRelativeTime(c.createdAt)}{c.editedAt ? ' (수정됨)' : ''}</span>
          </div>
          {editing === c.id ? (
            <div className="mt-1 space-y-2">
              <MentionTextarea value={editDraft} onChange={setEditDraft} users={users} onSubmit={() => updateM.mutate({ id: c.id, body: editDraft })} />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => updateM.mutate({ id: c.id, body: editDraft })} disabled={!editDraft.trim()}>저장</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>취소</Button>
              </div>
            </div>
          ) : c.deleted ? (
            <p className="text-sm text-muted-foreground italic mt-0.5">삭제된 댓글입니다.</p>
          ) : (
            <>
              <div className="text-sm mt-0.5"><MentionText body={c.body} /></div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {!isReply && <button className="hover:text-foreground inline-flex items-center gap-0.5" onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyDraft(''); }}><CornerDownRight className="h-3 w-3" />답글</button>}
                {canModify(c) && <button className="hover:text-foreground inline-flex items-center gap-0.5" onClick={() => { setEditing(c.id); setEditDraft(c.body); }}><Pencil className="h-3 w-3" />수정</button>}
                {(canModify(c) || isAdmin) && <button className="hover:text-destructive inline-flex items-center gap-0.5" onClick={() => { if (confirm('댓글을 삭제할까요?')) deleteM.mutate(c.id); }}><Trash2 className="h-3 w-3" />삭제</button>}
              </div>
            </>
          )}
          {replyTo === c.id && (
            <div className="mt-2 space-y-2">
              <MentionTextarea value={replyDraft} onChange={setReplyDraft} users={users} placeholder="답글 입력…" onSubmit={() => createM.mutate({ body: replyDraft, parentId: c.id })} />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => createM.mutate({ body: replyDraft, parentId: c.id })} disabled={!replyDraft.trim() || createM.isPending}>답글</Button>
                <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>취소</Button>
              </div>
            </div>
          )}
        </div>
      </div>
      {c.replies?.map((r) => renderComment(r, true))}
    </div>
  );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        댓글 {comments.length > 0 ? `(${comments.length})` : ''}
      </h3>

      {/* 작성 */}
      <div className="space-y-2">
        <MentionTextarea value={draft} onChange={setDraft} users={users} onSubmit={() => draft.trim() && createM.mutate({ body: draft })} />
        <div className="flex justify-end">
          <Button size="sm" onClick={() => createM.mutate({ body: draft })} disabled={!draft.trim() || createM.isPending}>
            {createM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : '댓글 작성'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          아직 댓글이 없습니다. 첫 댓글을 남겨 팀과 대화를 시작하세요.
          <br /><span className="text-xs">(고정 메모는 개요의 '메모' 섹션을 이용하세요.)</span>
        </p>
      ) : (
        <div>{comments.map((c) => renderComment(c))}</div>
      )}
    </div>
  );
}
