import { desc } from "drizzle-orm";
import { Sparkles } from "lucide-react";

import { db, engagementScores } from "@/lib/db";
import { ENGAGEMENT_THRESHOLD } from "@/lib/engagement";
import { relativeTime } from "@/lib/format-time";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EngagementLeaderboardPage() {
  const top = await db
    .select()
    .from(engagementScores)
    .orderBy(desc(engagementScores.score))
    .limit(10);

  const readyCount = top.filter((r) => r.score >= ENGAGEMENT_THRESHOLD).length;

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Engagement Leaderboard</h2>
        <p className="text-sm text-muted-foreground">
          Top 10 members by 30-day rolling engagement score · {readyCount} above the Premier-ready
          threshold ({ENGAGEMENT_THRESHOLD})
        </p>
      </header>

      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">Top engagers</CardTitle>
          <CardDescription>
            Score = points across course progress, posts, comments, RSVPs, and reactions over the
            last 30 days.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {top.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No engagement events scored yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">#</th>
                  <th className="px-6 py-3 text-left font-medium">Email</th>
                  <th className="px-6 py-3 text-right font-medium">Score</th>
                  <th className="px-6 py-3 text-left font-medium">Status</th>
                  <th className="px-6 py-3 text-right font-medium">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {top.map((row, idx) => {
                  const isReady = row.score >= ENGAGEMENT_THRESHOLD;
                  return (
                    <tr key={row.id} className="border-t">
                      <td className="px-6 py-3 font-mono text-xs text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="px-6 py-3">{row.mightyEmail}</td>
                      <td className="px-6 py-3 text-right font-semibold tabular-nums">
                        {row.score}
                      </td>
                      <td className="px-6 py-3">
                        {isReady ? (
                          <Badge className="gap-1 bg-brand-yellow/15 text-amber-700 dark:text-amber-400 border-brand-yellow/30">
                            <Sparkles className="h-3 w-3" />
                            Premier-ready
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {ENGAGEMENT_THRESHOLD - row.score} to threshold
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right text-xs text-muted-foreground">
                        {relativeTime(row.lastCalculatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
