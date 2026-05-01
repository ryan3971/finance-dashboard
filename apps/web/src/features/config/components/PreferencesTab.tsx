import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateUserConfigSchema } from '@finance/shared/schemas/user-config';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog';
import { FormField } from '@/components/common/FormField';
import { Input } from '@/components/ui/Input';
import { useUserConfig } from '../hooks/useUserConfig';
import { useUpdateUserConfig } from '../hooks/useUpdateUserConfig';
import { useResetAccount } from '../hooks/useResetAccount';
import { TOAST } from '@/lib/toastMessages';

// Flat form schema with coercion for HTML inputs. The sum-to-100 refine is
// delegated to the shared schema so the constraint stays in one place.
const allocationsValidator =
  updateUserConfigSchema.shape.allocations.unwrap();

const allocationFormSchema = z
  .object({
    needsPercentage: z.coerce.number().int().min(0).max(100),
    wantsPercentage: z.coerce.number().int().min(0).max(100),
    investmentsPercentage: z.coerce.number().int().min(0).max(100),
  })
  .refine((v) => allocationsValidator.safeParse(v).success, {
    message: 'Must sum to 100',
    path: ['needsPercentage'],
  });

type AllocationFormValues = z.infer<typeof allocationFormSchema>;

const emergencyFundFormSchema = z.object({
  emergencyFundTarget: z.coerce.number().min(0, 'Must be 0 or greater'),
});

type EmergencyFundFormValues = z.infer<typeof emergencyFundFormSchema>;

export function PreferencesTab() {
  const navigate = useNavigate();
  const { data: config } = useUserConfig();
  const updateConfig = useUpdateUserConfig();
  const resetAccount = useResetAccount();
  const [serverError, setServerError] = useState<string | null>(null);
  const [efServerError, setEfServerError] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AllocationFormValues>({
    resolver: zodResolver(allocationFormSchema),
    values: {
      needsPercentage: config?.needsPercentage ?? 0,
      wantsPercentage: config?.wantsPercentage ?? 0,
      investmentsPercentage: config?.investmentsPercentage ?? 0,
    },
  });

  const {
    register: registerEf,
    handleSubmit: handleSubmitEf,
    formState: { errors: efErrors },
  } = useForm<EmergencyFundFormValues>({
    resolver: zodResolver(emergencyFundFormSchema),
    values: {
      emergencyFundTarget: Number(config?.emergencyFundTarget ?? 0),
    },
  });

  const [needs, wants, investments] = watch([
    'needsPercentage',
    'wantsPercentage',
    'investmentsPercentage',
  ]);
  const total = (Number(needs) || 0) + (Number(wants) || 0) + (Number(investments) || 0);
  const sumValid = total === 100;

  function onSubmit(values: AllocationFormValues) {
    setServerError(null);
    updateConfig.mutate(
      {
        allocations: {
          needsPercentage: values.needsPercentage,
          wantsPercentage: values.wantsPercentage,
          investmentsPercentage: values.investmentsPercentage,
        },
      },
      {
        onError: () => {
          setServerError('Failed to save preferences. Please try again.');
        },
      }
    );
  }

  const onSubmitEmergencyFund: SubmitHandler<EmergencyFundFormValues> = (values) => {
    setEfServerError(null);
    updateConfig.mutate(
      { emergencyFundTarget: values.emergencyFundTarget === 0 ? null : values.emergencyFundTarget },
      {
        onError: () => {
          setEfServerError('Failed to save emergency fund target. Please try again.');
        },
      }
    );
  }

  function handleResetConfirm() {
    resetAccount.mutate(undefined, {
      onSuccess: () => {
        setResetDialogOpen(false);
        toast.success(TOAST.ACCOUNT_RESET);
        void navigate({ to: '/dashboard/snapshot' });
      },
      onError: () => {
        setResetDialogOpen(false);
        toast.error(TOAST.ACCOUNT_RESET_FAILED);
      },
    });
  }

  return (
    <div className="mt-4 space-y-6">
      <div className="bg-surface rounded-lg border border-border-base p-6">
        <h2 className="text-sm font-semibold text-content-primary mb-1">
          Income Allocation
        </h2>
        <p className="text-sm text-content-secondary mb-4">
          Set how your monthly income is split between Needs, Wants, and
          Investments. These percentages must sum to 100.
        </p>

        <form
          onSubmit={(e) => {
            void handleSubmit(onSubmit)(e);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Needs %" error={errors.needsPercentage?.message}>
              <Input
                type="number"
                min={0}
                max={100}
                {...register('needsPercentage')}
              />
            </FormField>
            <FormField label="Wants %">
              <Input
                type="number"
                min={0}
                max={100}
                {...register('wantsPercentage')}
              />
            </FormField>
            <FormField label="Investments %">
              <Input
                type="number"
                min={0}
                max={100}
                {...register('investmentsPercentage')}
              />
            </FormField>
          </div>

          <p
            className={`text-sm font-medium ${sumValid ? 'text-positive' : 'text-danger'}`}
          >
            {Number(needs) || 0} + {Number(wants) || 0} + {Number(investments) || 0} = {total}
            {sumValid ? ' ✓' : ' (must equal 100)'}
          </p>

          {serverError && <p className="text-sm text-danger">{serverError}</p>}

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={updateConfig.isPending || !sumValid}
          >
            {updateConfig.isPending ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </div>

      <div className="bg-surface rounded-lg border border-border-base p-6">
        <h2 className="text-sm font-semibold text-content-primary mb-1">
          Emergency Fund
        </h2>
        <p className="text-sm text-content-secondary mb-4">
          Set a savings target for your emergency fund. This is measured against
          the total balance of your chequing accounts.
        </p>
        <form
          onSubmit={(e) => {
            void handleSubmitEf(onSubmitEmergencyFund)(e);
          }}
          className="space-y-4"
        >
          <div className="max-w-xs">
            <FormField
              label="Target amount"
              error={efErrors.emergencyFundTarget?.message}
            >
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="e.g. 10000"
                {...registerEf('emergencyFundTarget')}
              />
            </FormField>
          </div>

          {efServerError && (
            <p className="text-sm text-danger">{efServerError}</p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={updateConfig.isPending}
          >
            {updateConfig.isPending ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </div>

      <div className="bg-surface rounded-lg border border-border-base p-6">
        <h2 className="text-sm font-semibold text-content-primary mb-1">
          Reset Account
        </h2>
        <p className="text-sm text-content-secondary mb-4">
          Permanently delete all your accounts, transactions, categories, rules,
          and budget entries. Default categories and rules will be restored.
          This cannot be undone.
        </p>
        <Button
          variant="warning"
          size="md"
          onClick={() => setResetDialogOpen(true)}
        >
          Reset account
        </Button>
      </div>

      <DeleteConfirmDialog
        open={resetDialogOpen}
        title="Reset account"
        description="This will permanently delete all your accounts, transactions, categories, rules, and budget entries. Default categories and rules will be restored. This cannot be undone."
        confirmLabel="Reset account"
        isPending={resetAccount.isPending}
        onConfirm={handleResetConfirm}
        onCancel={() => setResetDialogOpen(false)}
      />
    </div>
  );
}
