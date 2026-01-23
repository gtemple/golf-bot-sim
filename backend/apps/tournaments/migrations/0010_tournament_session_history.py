from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('tournaments', '0009_tournament_format_tournamententry_team'),
    ]

    operations = [
        migrations.AddField(
            model_name='tournament',
            name='session_history',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]