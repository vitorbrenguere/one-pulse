import { useId, useState } from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { formatDateTime } from '../../../lib/dates';
import type { EvaluationDTO } from '../../../types/api';
import { getEvaluationViewState, type EvaluationAction } from '../view-state';
import { ManagerEvaluationForm, SelfEvaluationForm } from './PartForms';

const ACTION_LABELS: Record<Exclude<EvaluationAction, null>, string> = {
  FILL_SELF: 'Preencher autoavaliação',
  EVALUATE: 'Avaliar',
  VIEW_RESULT: 'Ver resultado',
};

const formatScore = (score: number | null) => (score === null ? 'Sem nota' : `${score} de 5`);

interface PartViewProps {
  title: string;
  scoreLabel: string;
  score: number | null;
  textLabel: string;
  text: string | null;
  submittedAt: string | null;
}

/** Uma parte já enviada, somente leitura. */
function PartView({ title, scoreLabel, score, textLabel, text, submittedAt }: PartViewProps) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-zinc-200 p-4">
      <h4 className="text-sm font-semibold text-zinc-900">{title}</h4>
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="text-zinc-600">{scoreLabel}</dt>
          <dd className="font-medium text-zinc-900">{formatScore(score)}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">{textLabel}</dt>
          <dd className="whitespace-pre-line text-zinc-900">{text ?? 'Sem comentários.'}</dd>
        </div>
      </dl>
      {submittedAt && <p className="text-xs text-zinc-600">Enviada em {formatDateTime(submittedAt)}.</p>}
    </div>
  );
}

const selfPart = (e: EvaluationDTO) => (
  <PartView
    title="Autoavaliação"
    scoreLabel="Nota da autoavaliação"
    score={e.selfScore}
    textLabel="Comentários"
    text={e.selfComments}
    submittedAt={e.selfSubmittedAt}
  />
);

const managerPart = (e: EvaluationDTO) => (
  <PartView
    title="Avaliação do gestor"
    scoreLabel="Nota do gestor"
    score={e.managerScore}
    textLabel="Feedback"
    text={e.managerFeedback}
    submittedAt={e.managerSubmittedAt}
  />
);

/**
 * O que o viewer sabe sobre a parte da outra pessoa. Campos ocultos pela API chegam `null`
 * e NUNCA são exibidos como valor: a mensagem vem do status / `*SubmittedAt` (spec 05 §6.5.1).
 */
function otherPartStatus(evaluation: EvaluationDTO, isEvaluatee: boolean): string | null {
  if (evaluation.status === 'CONCLUIDA') return null;
  if (isEvaluatee) {
    return evaluation.managerSubmittedAt
      ? `Avaliação do gestor enviada em ${formatDateTime(evaluation.managerSubmittedAt)}. Será revelada quando a avaliação for concluída.`
      : 'O gestor ainda não enviou.';
  }
  return evaluation.selfSubmittedAt
    ? `Autoavaliação enviada em ${formatDateTime(evaluation.selfSubmittedAt)}.`
    : 'A autoavaliação ainda não foi enviada.';
}

function ExpandedContent({ evaluation, isEvaluatee }: { evaluation: EvaluationDTO; isEvaluatee: boolean }) {
  if (evaluation.status === 'CONCLUIDA') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {selfPart(evaluation)}
        {managerPart(evaluation)}
      </div>
    );
  }
  if (isEvaluatee) {
    return evaluation.selfSubmittedAt ? selfPart(evaluation) : <SelfEvaluationForm evaluation={evaluation} />;
  }
  return (
    <div className="flex flex-col gap-3">
      {evaluation.selfSubmittedAt && selfPart(evaluation)}
      {evaluation.managerSubmittedAt ? managerPart(evaluation) : <ManagerEvaluationForm evaluation={evaluation} />}
    </div>
  );
}

interface EvaluationCardProps {
  evaluation: EvaluationDTO;
  viewerId: number;
  /** Nome acessível do card: o ciclo, ou `<nome> · <ciclo>` na visão da equipe. */
  title: string;
}

/** Card de avaliação: o botão de ação expande o formulário no próprio card (spec 05 §6.6). */
export function EvaluationCard({ evaluation, viewerId, title }: EvaluationCardProps) {
  const titleId = useId();
  const [expanded, setExpanded] = useState(false);
  const view = getEvaluationViewState(evaluation, viewerId);
  const isEvaluatee = view.role === 'EVALUATEE';
  const otherStatus = otherPartStatus(evaluation, isEvaluatee);

  return (
    <article aria-labelledby={titleId} className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h3 id={titleId} className="font-semibold text-zinc-900">
            {title}
          </h3>
          {isEvaluatee && <p className="text-sm text-zinc-600">Avaliador: Seu gestor</p>}
        </div>
        <Badge tone={view.tone}>{view.label}</Badge>
      </div>

      {otherStatus && <p className="text-sm text-zinc-700">{otherStatus}</p>}

      {!expanded && (
        <div>
          <Button variant={view.action ? 'primary' : 'secondary'} size="sm" onClick={() => setExpanded(true)}>
            {view.action ? ACTION_LABELS[view.action] : 'Ver detalhes'}
          </Button>
        </div>
      )}

      {expanded && <ExpandedContent evaluation={evaluation} isEvaluatee={isEvaluatee} />}
    </article>
  );
}
