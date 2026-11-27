import { Clock, Lock, UserRound, UserRoundCheck } from 'lucide-react';
import { useId, useState } from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { cn } from '../../../lib/cn';
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
  kind: 'self' | 'manager';
  title: string;
  scoreLabel: string;
  score: number | null;
  textLabel: string;
  text: string | null;
  submittedAt: string | null;
}

/** Pontos da escala de 1 a 5 (decorativo: o valor acessível é o texto "N de 5"). */
function ScoreDots({ score, dark }: { score: number | null; dark: boolean }) {
  const filled = dark ? 'bg-purple-400' : 'bg-purple-600';
  const empty = dark ? 'bg-white/15' : 'bg-purple-100';
  return (
    <span aria-hidden="true" className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((point) => (
        <span key={point} className={cn('h-1.5 w-6 rounded-full', score !== null && point <= score ? filled : empty)} />
      ))}
    </span>
  );
}

/** Uma parte já enviada, somente leitura. A do gestor usa o card escuro para contrastar na comparação. */
function PartView({ kind, title, scoreLabel, score, textLabel, text, submittedAt }: PartViewProps) {
  const dark = kind === 'manager';
  const Icon = dark ? UserRoundCheck : UserRound;
  return (
    <div className={cn('flex flex-col gap-4 rounded-2xl p-5', dark ? 'bg-ink-950 text-white' : 'border border-purple-100 bg-canvas')}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-9 items-center justify-center rounded-full',
            dark ? 'bg-white/10 text-purple-200' : 'bg-white text-purple-600 ring-1 ring-purple-100',
          )}
        >
          <Icon className="size-4" />
        </span>
        <h4 className={cn('text-sm font-semibold', dark ? 'text-white' : 'text-zinc-900')}>{title}</h4>
      </div>
      <dl className="flex flex-col gap-4 text-sm">
        <div className="flex flex-col gap-2">
          <dt className={dark ? 'text-purple-200' : 'text-zinc-600'}>{scoreLabel}</dt>
          <dd className={cn('text-3xl font-semibold tracking-tight tabular-nums', dark ? 'text-white' : 'text-zinc-900')}>
            {formatScore(score)}
          </dd>
          <ScoreDots score={score} dark={dark} />
        </div>
        <div className={cn('flex flex-col gap-1 border-t pt-4', dark ? 'border-white/10' : 'border-purple-100')}>
          <dt className={dark ? 'text-purple-200' : 'text-zinc-600'}>{textLabel}</dt>
          <dd className={cn('leading-relaxed whitespace-pre-line', dark ? 'text-purple-50' : 'text-zinc-800')}>
            {text ?? 'Sem comentários.'}
          </dd>
        </div>
      </dl>
      {submittedAt && (
        <p className={cn('mt-auto text-xs', dark ? 'text-purple-300' : 'text-zinc-500')}>
          Enviada em {formatDateTime(submittedAt)}.
        </p>
      )}
    </div>
  );
}

const selfPart = (e: EvaluationDTO) => (
  <PartView
    kind="self"
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
    kind="manager"
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
interface OtherPartStatus {
  text: string;
  /** Parte do gestor vista pelo avaliado: oculta pela API até a conclusão (cadeado). */
  locked: boolean;
}

function otherPartStatus(evaluation: EvaluationDTO, isEvaluatee: boolean): OtherPartStatus | null {
  if (evaluation.status === 'CONCLUIDA') return null;
  if (isEvaluatee) {
    const text = evaluation.managerSubmittedAt
      ? `Avaliação do gestor enviada em ${formatDateTime(evaluation.managerSubmittedAt)}. Será revelada quando a avaliação for concluída.`
      : 'O gestor ainda não enviou.';
    return { text, locked: true };
  }
  const text = evaluation.selfSubmittedAt
    ? `Autoavaliação enviada em ${formatDateTime(evaluation.selfSubmittedAt)}.`
    : 'A autoavaliação ainda não foi enviada.';
  return { text, locked: false };
}

function OtherPartNotice({ status }: { status: OtherPartStatus }) {
  const Icon = status.locked ? Lock : Clock;
  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-2xl p-4',
        status.locked ? 'bg-linear-to-br from-ink-800 to-ink-700' : 'border border-purple-100 bg-canvas',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full',
          status.locked ? 'bg-white/10 text-purple-200 ring-1 ring-white/15' : 'bg-white text-purple-600 ring-1 ring-purple-100',
        )}
      >
        <Icon className="size-4" />
      </span>
      <p className={cn('text-sm', status.locked ? 'text-purple-100' : 'text-zinc-700')}>{status.text}</p>
    </div>
  );
}

function ExpandedContent({ evaluation, isEvaluatee }: { evaluation: EvaluationDTO; isEvaluatee: boolean }) {
  if (evaluation.status === 'CONCLUIDA') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
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
    <article aria-labelledby={titleId} className="flex flex-col gap-5 rounded-3xl border border-purple-100/80 bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h3 id={titleId} className="text-lg font-semibold tracking-tight text-zinc-900">
            {title}
          </h3>
          {isEvaluatee && <p className="text-sm text-zinc-600">Avaliador: Seu gestor</p>}
        </div>
        <Badge tone={view.tone}>{view.label}</Badge>
      </div>

      {otherStatus && <OtherPartNotice status={otherStatus} />}

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
