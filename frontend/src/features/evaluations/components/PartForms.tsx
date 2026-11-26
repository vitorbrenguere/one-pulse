import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/Dialog';
import { Field } from '../../../components/ui/Field';
import { Textarea } from '../../../components/ui/Input';
import { ScoreInput } from '../../../components/ui/ScoreInput';
import { ErrorBanner } from '../../../components/ui/States';
import { toFormErrors } from '../../../lib/form-errors';
import type { EvaluationDTO } from '../../../types/api';
import type { ManagerPartInput, SelfPartInput } from '../api';
import { useUpdateEvaluation } from '../hooks/useEvaluations';
import { FEEDBACK_REQUIRED, SCORE_REQUIRED, SUBMIT_WARNING } from './messages';

type PartErrors = Partial<Record<'score' | 'text', string>>;

interface PartFormConfig {
  part: 'self' | 'manager';
  textLabel: string;
  textRequired: boolean;
  initialScore: number | null;
  initialText: string | null;
  /** Monta o payload da parte do viewer (nunca mistura as duas partes: spec 04 §2.3). */
  toPayload: (score: number | null, text: string | null) => SelfPartInput | ManagerPartInput;
  scoreField: string;
  textField: string;
}

const MAX_TEXT = 2000;

/**
 * Rascunho editável + envio com confirmação (spec 05 §6.5.4). "Salvar rascunho" não exige nada;
 * "Enviar" exige a nota (e, para o gestor, o feedback) com as mesmas mensagens da API.
 */
function PartForm({ evaluationId, config }: { evaluationId: number; config: PartFormConfig }) {
  const update = useUpdateEvaluation(evaluationId);
  const [score, setScore] = useState<number | null>(config.initialScore);
  const [text, setText] = useState(config.initialText ?? '');
  const [clientErrors, setClientErrors] = useState<PartErrors>({});
  const [confirming, setConfirming] = useState(false);

  const serverErrors = update.isError ? toFormErrors(update.error, [config.scoreField, config.textField]) : null;
  const errors: PartErrors = {
    ...(serverErrors?.fieldErrors[config.scoreField] ? { score: serverErrors.fieldErrors[config.scoreField] } : {}),
    ...(serverErrors?.fieldErrors[config.textField] ? { text: serverErrors.fieldErrors[config.textField] } : {}),
    ...clientErrors,
  };

  const trimmed = text.trim();
  const textTooLong = trimmed.length > MAX_TEXT ? `Máximo de ${MAX_TEXT} caracteres.` : undefined;
  const payload = (submit: boolean) => ({ ...config.toPayload(score, trimmed || null), ...(submit ? { submit: true as const } : {}) });

  const saveDraft = () => {
    if (update.isPending) return;
    setClientErrors(textTooLong ? { text: textTooLong } : {});
    if (!textTooLong) update.mutate(payload(false));
  };

  const requestSubmit = () => {
    const validation: PartErrors = {};
    if (score === null) validation.score = SCORE_REQUIRED;
    if (config.textRequired && !trimmed) validation.text = FEEDBACK_REQUIRED;
    if (textTooLong) validation.text = textTooLong;
    setClientErrors(validation);
    if (Object.keys(validation).length === 0) setConfirming(true);
  };

  return (
    <div className="flex flex-col gap-4">
      {serverErrors?.banner && <ErrorBanner error={serverErrors.banner} />}
      <ScoreInput value={score} onChange={setScore} error={errors.score} />
      <Field label={config.textLabel} error={errors.text} hint={config.textRequired ? 'Obrigatório para enviar.' : 'Opcional.'}>
        {(control) => <Textarea {...control} value={text} onChange={(e) => setText(e.target.value)} />}
      </Field>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={saveDraft} disabled={update.isPending}>
          Salvar rascunho
        </Button>
        <Button onClick={requestSubmit} disabled={update.isPending}>
          Enviar
        </Button>
      </div>
      {confirming && (
        <ConfirmDialog
          title={config.part === 'self' ? 'Enviar autoavaliação?' : 'Enviar avaliação?'}
          message={SUBMIT_WARNING}
          pending={update.isPending}
          onConfirm={() => update.mutate(payload(true), { onSettled: () => setConfirming(false) })}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

export function SelfEvaluationForm({ evaluation }: { evaluation: EvaluationDTO }) {
  return (
    <PartForm
      evaluationId={evaluation.id}
      config={{
        part: 'self',
        textLabel: 'Comentários',
        textRequired: false,
        initialScore: evaluation.selfScore,
        initialText: evaluation.selfComments,
        toPayload: (selfScore, selfComments) => ({ selfScore, selfComments }),
        scoreField: 'selfScore',
        textField: 'selfComments',
      }}
    />
  );
}

export function ManagerEvaluationForm({ evaluation }: { evaluation: EvaluationDTO }) {
  return (
    <PartForm
      evaluationId={evaluation.id}
      config={{
        part: 'manager',
        textLabel: 'Feedback',
        textRequired: true,
        initialScore: evaluation.managerScore,
        initialText: evaluation.managerFeedback,
        toPayload: (managerScore, managerFeedback) => ({ managerScore, managerFeedback }),
        scoreField: 'managerScore',
        textField: 'managerFeedback',
      }}
    />
  );
}
