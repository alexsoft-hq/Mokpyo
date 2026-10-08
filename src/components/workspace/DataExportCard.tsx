import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { downloadOrganizationExport } from '@/lib/api/organizations';

/** 워크스페이스 데이터 전체를 JSON 으로 내려받는 카드(OWNER/ADMIN). 데이터 이동권·백업 용도. */
export function DataExportCard({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      const filename = await downloadOrganizationExport(orgId);
      toast({ title: '내보내기 완료', description: `${filename} 파일을 저장했습니다.` });
    } catch (e: any) {
      toast({ title: '내보내기 실패', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Download className="h-5 w-5" />
          데이터 내보내기
        </CardTitle>
        <CardDescription>
          프로젝트, 목표, 하위 목표, 댓글, 체크인, 상태, 사이클, 저장된 뷰, 자동화 규칙, 감사 로그(최근 2만 건)를 JSON 한 파일로 내려받습니다. 언제든 데이터를 가져갈 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={handleExport} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          JSON 으로 내보내기
        </Button>
      </CardContent>
    </Card>
  );
}
