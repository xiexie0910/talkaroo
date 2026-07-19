import { SessionClient } from "@/components/SessionClient";
import { scenarioById } from "@/lib/scenarios";

type SessionPageProps = {
  searchParams: Promise<{
    scenario?: string;
    mission?: string;
    starter?: string;
  }>;
};

export default async function SessionPage({ searchParams }: SessionPageProps) {
  const params = await searchParams;
  const scenarioId =
    params.scenario && scenarioById[params.scenario]
      ? params.scenario
      : undefined;
  const mission = params.mission?.trim();
  const starter = params.starter?.trim();

  return (
    <main className="h-dvh min-h-0 flex-1 overflow-hidden">
      <SessionClient
        initialScenarioId={scenarioId}
        initialMission={
          mission
            ? {
                objective: mission.slice(0, 240),
                starterPhrase: starter ? starter.slice(0, 120) : undefined,
              }
            : null
        }
      />
    </main>
  );
}
